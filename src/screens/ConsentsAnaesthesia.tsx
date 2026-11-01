import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { EstablishmentOut } from "../generated/facility_profile";
import type {
  ConsentWorklistItemOut,
  ConsentBriefOut,
  ConsentFormOut,
  ConsentOut,
  PrintOut_ConsentPrintFieldsOut_,
} from "../generated/consents_anaesthesia";
import {
  worklistConsent,
  listConsents,
  listForms,
  createConsents,
  getConsent,
  update,
  printConsent,
  sign,
  refuse,
  withdrawConsents,
  cancelConsents,
  scanConsents,
  uploadDocumentPatientsDocuments,
} from "../generated/consents_anaesthesia";
import {
  getConsentsAnaesthesiaScreenView,
  isSurgeryActive,
  canManageConsents,
  validateConsentDraft,
  validateConsentSign,
  validateConsentRefuse,
  explainConsentError,
  ClinicalUser,
} from "../consents-anaesthesia-policy";

export interface ConsentsAnaesthesiaProps {
  establishment?: EstablishmentOut | null;
  currentUser?: ClinicalUser | null;
  connected?: boolean;
  stream?: any;
  timeZone?: string;
  onNavigate?: (screenId: string) => void;
  onNavigateScreen?: (screenId: string) => void;
}

export const ConsentsAnaesthesia: React.FC<ConsentsAnaesthesiaProps> = ({
  establishment,
  currentUser,
  connected = true,
  stream,
  timeZone = "Asia/Karachi",
  onNavigate,
  onNavigateScreen,
}) => {
  const viewMode = getConsentsAnaesthesiaScreenView(establishment);
  const surgeryActive = isSurgeryActive(establishment);
  const authorized = canManageConsents(currentUser);

  // Top Tabs: "worklist" | "register" | "detail"
  const [activeTab, setActiveTab] = useState<"worklist" | "register" | "detail">("worklist");

  // Worklist state
  const [worklist, setWorklist] = useState<ConsentWorklistItemOut[]>([]);
  const [filterMine, setFilterMine] = useState<boolean>(false);
  const [filterDays, setFilterDays] = useState<number>(7);
  const [filterKind, setFilterKind] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Consent Register state
  const [consentRegister, setConsentRegister] = useState<ConsentBriefOut[]>([]);
  const [registerStatusFilter, setRegisterStatusFilter] = useState<string>("all");

  // Available forms
  const [forms, setForms] = useState<ConsentFormOut[]>([]);

  // Active / Selected Consent
  const [selectedConsentId, setSelectedConsentId] = useState<number | null>(null);
  const [activeConsent, setActiveConsent] = useState<ConsentOut | null>(null);

  // Form edit states
  const [formCode, setFormCode] = useState<string>("ANAESTHESIA");
  const [language, setLanguage] = useState<
    "English" | "Urdu" | "Punjabi" | "Saraiki" | "Pashto" | "Sindhi" | "Balochi"
  >("Urdu");
  const [procedureName, setProcedureName] = useState<string>("");
  const [performerName, setPerformerName] = useState<string>("");
  const [risks, setRisks] = useState<string>("");
  const [benefits, setBenefits] = useState<string>("");
  const [alternatives, setAlternatives] = useState<string>("");
  const [readToPatient, setReadToPatient] = useState<boolean>(false);
  const [interpreterName, setInterpreterName] = useState<string>("");

  // Sign Modal state
  const [showSignModal, setShowSignModal] = useState<boolean>(false);
  const [signMode, setSignMode] = useState<"Signed" | "EmergencyNote">("Signed");
  const [signerType, setSignerType] = useState<"Patient" | "DecisionMaker">("Patient");
  const [signerRelationship, setSignerRelationship] = useState<string>("");
  const [signerName, setSignerName] = useState<string>("");
  const [signerCnic, setSignerCnic] = useState<string>("");
  const [signerPhone, setSignerPhone] = useState<string>("");
  const [incapacityReason, setIncapacityReason] = useState<string>("");
  const [signerMark, setSignerMark] = useState<"Signature" | "ThumbImpression">("Signature");
  const [witnessName, setWitnessName] = useState<string>("");
  const [witnessRole, setWitnessRole] = useState<string>("");
  const [questionsAnswers, setQuestionsAnswers] = useState<string>("None asked");
  const [understandingConfirmed, setUnderstandingConfirmed] = useState<boolean>(true);
  const [emergencyNote, setEmergencyNote] = useState<string>("");
  const [secondDoctorId, setSecondDoctorId] = useState<number | null>(null);

  // Refuse Modal state
  const [showRefuseModal, setShowRefuseModal] = useState<boolean>(false);
  const [refuseMode, setRefuseMode] = useState<"Signed" | "VerbalRefusal">("Signed");
  const [refuseReason, setRefuseReason] = useState<string>("");
  const [refuseWitness, setRefuseWitness] = useState<string>("");

  // Withdraw Modal state
  const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);
  const [withdrawReason, setWithdrawReason] = useState<string>("");

  // Cancel Modal state
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>("");

  // Scan Upload Modal state
  const [showScanModal, setShowScanModal] = useState<boolean>(false);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanTitle, setScanTitle] = useState<string>("Signed Anaesthesia Consent Form");

  // Print Payload Modal
  const [printPayload, setPrintPayload] = useState<PrintOut_ConsentPrintFieldsOut_ | null>(null);

  // UI status
  const [loading, setLoading] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<{ en: string; ur: string } | null>(null);
  const [successBanner, setSuccessBanner] = useState<{ en: string; ur: string } | null>(null);

  // Load forms
  const loadAvailableForms = useCallback(async () => {
    try {
      const data = await listForms();
      setForms(data);
    } catch (err: any) {
      console.warn("Could not load consent forms:", err);
    }
  }, []);

  // Load worklist (Rule e9d9f576df)
  const loadWorklist = useCallback(async () => {
    try {
      setLoading(true);
      setErrorBanner(null);
      const data = await worklistConsent({ days: filterDays, mine: filterMine });
      setWorklist(data);
    } catch (err: any) {
      setErrorBanner(explainConsentError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  }, [filterDays, filterMine]);

  // Load consent register
  const loadConsentRegister = useCallback(async () => {
    try {
      setLoading(true);
      setErrorBanner(null);
      const query: any = { limit: 50 };
      if (registerStatusFilter !== "all") {
        query.status = registerStatusFilter;
      }
      const data = await listConsents(query);
      setConsentRegister(data);
    } catch (err: any) {
      setErrorBanner(explainConsentError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  }, [registerStatusFilter]);

  // Load single consent detail
  const loadConsentDetail = useCallback(async (consentId: number) => {
    try {
      setLoading(true);
      setErrorBanner(null);
      const data = await getConsent(consentId);
      setActiveConsent(data);
      setSelectedConsentId(data.consent_id);

      // Populate draft fields
      setFormCode(data.form_code);
      setLanguage(data.language);
      setProcedureName(data.procedure_name ?? "");
      setPerformerName(data.performer_name ?? "");
      setRisks(data.risks ?? "");
      setBenefits(data.benefits ?? "");
      setAlternatives(data.alternatives ?? "");
      setReadToPatient(data.read_to_patient);
      setInterpreterName(data.interpreter_name ?? "");

      // Setup signer defaults from who_decides (Rule cb2f327ee7)
      if (data.who_decides && !data.who_decides.patient_may_sign) {
        setSignerType("DecisionMaker");
        if (data.who_decides.decision_makers.length > 0) {
          setSignerRelationship(data.who_decides.decision_makers[0].relationship);
        }
        setIncapacityReason(data.who_decides.patient_is_minor ? "Minor" : "Unconscious");
      } else {
        setSignerType("Patient");
        setSignerName(data.patient_name);
      }

      setActiveTab("detail");
    } catch (err: any) {
      setErrorBanner(explainConsentError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load & realtime subscription
  useEffect(() => {
    loadAvailableForms();
    loadWorklist();
  }, [loadAvailableForms, loadWorklist]);

  useEffect(() => {
    if (!stream?.subscribe) return;
    const unsub = stream.subscribe("consent.updated", () => {
      loadWorklist();
      if (activeTab === "register") loadConsentRegister();
      if (selectedConsentId) loadConsentDetail(selectedConsentId);
    });
    return unsub;
  }, [stream, activeTab, selectedConsentId, loadWorklist, loadConsentRegister, loadConsentDetail]);

  // Filtered worklist items
  const filteredWorklist = useMemo(() => {
    let items = worklist;
    if (filterKind !== "all") {
      items = items.filter((item) => item.kind === filterKind);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.patient_name.toLowerCase().includes(q) ||
          item.mrn.toLowerCase().includes(q) ||
          (item.procedure_name && item.procedure_name.toLowerCase().includes(q))
      );
    }
    return items;
  }, [worklist, filterKind, searchQuery]);

  // Handle open/create from worklist item
  const handleWorklistAction = async (item: ConsentWorklistItemOut) => {
    if (item.consent_id) {
      await loadConsentDetail(item.consent_id);
    } else {
      // Prepare new consent
      try {
        setLoading(true);
        setErrorBanner(null);
        const newConsent = await createConsents({
          form_code: item.kind === "OperationConsent" ? "OPERATION" : "ANAESTHESIA",
          language: "Urdu",
          patient_id: item.patient_id,
          booking_id: item.booking_id,
          admission_id: item.admission_id,
          procedure_name: item.procedure_name ?? undefined,
        });
        await loadConsentDetail(newConsent.consent_id);
      } catch (err: any) {
        setErrorBanner(explainConsentError(err?.code || "INTERNAL_ERROR", err?.details));
      } finally {
        setLoading(false);
      }
    }
  };

  // Save Draft updates (Rule d84307d9b2)
  const handleSaveDraft = async () => {
    if (!activeConsent) return;
    const val = validateConsentDraft({
      form_code: formCode,
      language,
      procedure_name: procedureName,
    });
    if (!val.valid) {
      setErrorBanner({ en: val.errors.join(" "), ur: "ڈرافٹ کی معلومات نامکمل ہیں۔" });
      return;
    }

    try {
      setLoading(true);
      setErrorBanner(null);
      const updated = await update(activeConsent.consent_id, {
        procedure_name: procedureName.trim() || null,
        performer_name: performerName.trim() || null,
        risks: risks.trim() || null,
        benefits: benefits.trim() || null,
        alternatives: alternatives.trim() || null,
        language,
        expected_version: activeConsent.row_version,
      });
      setActiveConsent(updated);
      setSuccessBanner({
        en: "Consent draft updated successfully.",
        ur: "رضامندی ڈرافٹ کامیابی سے اپ ڈیٹ ہو گیا۔",
      });
    } catch (err: any) {
      setErrorBanner(explainConsentError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  };

  // Sign consent (Rule b7bacc1ffb & Rule cb2f327ee7)
  const handleConfirmSign = async () => {
    if (!activeConsent) return;

    const payload: any = {
      mode: signMode,
      signer: signMode === "Signed" ? signerType : undefined,
      signer_name: signMode === "Signed" ? signerName.trim() || activeConsent.patient_name : undefined,
      signer_relationship:
        signMode === "Signed" && signerType === "DecisionMaker" ? (signerRelationship as any) : undefined,
      signer_cnic: signerCnic.trim() || undefined,
      signer_phone: signerPhone.trim() || undefined,
      incapacity_reason:
        signMode === "Signed" && signerType === "DecisionMaker" ? (incapacityReason as any) : undefined,
      signer_mark: signMode === "Signed" ? signerMark : undefined,
      witness_name: witnessName.trim() || undefined,
      witness_role: witnessRole.trim() || undefined,
      read_to_patient: readToPatient,
      interpreter_name: interpreterName.trim() || undefined,
      questions_answers: questionsAnswers.trim() || "None asked",
      understanding_confirmed: understandingConfirmed,
      emergency_note: signMode === "EmergencyNote" ? emergencyNote.trim() : undefined,
      second_doctor_id: signMode === "EmergencyNote" ? secondDoctorId : undefined,
      expected_version: activeConsent.row_version,
    };

    const val = validateConsentSign(payload, activeConsent.who_decides);
    if (!val.valid) {
      setErrorBanner({ en: val.errors.join(" "), ur: "دستخط نامکمل ہیں: تمام لازمی خانے پر کریں۔" });
      return;
    }

    try {
      setLoading(true);
      setErrorBanner(null);
      const signedOut = await sign(activeConsent.consent_id, payload);
      setActiveConsent(signedOut);
      setShowSignModal(false);
      setSuccessBanner({
        en: "Informed consent successfully recorded and signed (Given).",
        ur: "باضابطہ رضامندی کامیابی سے محفوظ اور دستخط ہو گئی۔",
      });
      loadWorklist();
    } catch (err: any) {
      setErrorBanner(explainConsentError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  };

  // Refuse consent (Rule b7bacc1ffb)
  const handleConfirmRefuse = async () => {
    if (!activeConsent) return;

    const payload: any = {
      mode: refuseMode,
      refusal_reason: refuseReason.trim(),
      witness_name: refuseWitness.trim() || undefined,
      expected_version: activeConsent.row_version,
    };

    const val = validateConsentRefuse(payload);
    if (!val.valid) {
      setErrorBanner({ en: val.errors.join(" "), ur: "انکار کی معلومات نامکمل ہیں۔" });
      return;
    }

    try {
      setLoading(true);
      setErrorBanner(null);
      const refusedOut = await refuse(activeConsent.consent_id, payload);
      setActiveConsent(refusedOut);
      setShowRefuseModal(false);
      setSuccessBanner({
        en: "Consent refusal recorded successfully.",
        ur: "رضامندی کا باضابطہ انکار محفوظ کر لیا گیا۔",
      });
      loadWorklist();
    } catch (err: any) {
      setErrorBanner(explainConsentError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  };

  // Withdraw consent (Rule 8b7301ca0f)
  const handleConfirmWithdraw = async () => {
    if (!activeConsent) return;
    if (!withdrawReason.trim()) {
      setErrorBanner({ en: "Withdrawal reason is mandatory.", ur: "منسوخی کی وجہ لازمی ہے۔" });
      return;
    }

    try {
      setLoading(true);
      setErrorBanner(null);
      const withdrawn = await withdrawConsents(activeConsent.consent_id, {
        reason: withdrawReason.trim(),
      });
      setActiveConsent(withdrawn);
      setShowWithdrawModal(false);
      setWithdrawReason("");
      setSuccessBanner({
        en: "Consent has been withdrawn. A new consent must be taken prior to surgery.",
        ur: "رضامندی منسوخ کر دی گئی ہے۔ آپریشن سے قبل نئی رضامندی درکار ہو گی۔",
      });
      loadWorklist();
    } catch (err: any) {
      setErrorBanner(explainConsentError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  };

  // Cancel draft consent
  const handleConfirmCancel = async () => {
    if (!activeConsent) return;
    if (!cancelReason.trim()) {
      setErrorBanner({ en: "Cancellation reason is mandatory.", ur: "کینسل کرنے کی وجہ لازمی ہے۔" });
      return;
    }

    try {
      setLoading(true);
      setErrorBanner(null);
      const cancelled = await cancelConsents(activeConsent.consent_id, {
        reason: cancelReason.trim(),
      });
      setActiveConsent(cancelled);
      setShowCancelModal(false);
      setCancelReason("");
      setSuccessBanner({
        en: "Draft consent cancelled successfully.",
        ur: "ڈرافٹ رضامندی کینسل ہو گئی۔",
      });
      loadWorklist();
    } catch (err: any) {
      setErrorBanner(explainConsentError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  };

  // Print payload preview (Rule fea5622fc5)
  const handleFetchPrint = async () => {
    if (!activeConsent) return;
    try {
      setLoading(true);
      setErrorBanner(null);
      const printData = await printConsent(activeConsent.consent_id);
      setPrintPayload(printData);
    } catch (err: any) {
      setErrorBanner(explainConsentError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  };

  // Upload signed document scan (Rule 8b7301ca0f)
  const handleConfirmScan = async () => {
    if (!activeConsent || !scanFile) {
      setErrorBanner({ en: "Please select a document file to upload.", ur: "برائے مہربانی دستاویز کی فائل منتخب کریں۔" });
      return;
    }

    try {
      setLoading(true);
      setErrorBanner(null);

      // 1. Upload to patient documents
      const formData = new FormData();
      formData.append("file", scanFile);
      formData.append("doc_type", "Consent");
      formData.append("title", scanTitle);
      const uploadedDoc = await uploadDocumentPatientsDocuments(activeConsent.patient_id, formData);

      // 2. Attach scan to consent
      const scannedConsent = await scanConsents(activeConsent.consent_id, {
        document_id: uploadedDoc.document_id,
      });
      setActiveConsent(scannedConsent);
      setShowScanModal(false);
      setScanFile(null);
      setSuccessBanner({
        en: `Signed paper consent attached successfully (Document #${uploadedDoc.document_id}).`,
        ur: `دستخط شدہ کاغذ کی اسکین کاپی کامیابی سے منسلک ہو گئی۔`,
      });
      loadWorklist();
    } catch (err: any) {
      setErrorBanner(explainConsentError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  };

  if (viewMode === "hidden") {
    return (
      <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-xl m-4 border border-slate-200">
        <p className="font-semibold text-sm">Consents to anaesthesia is hidden in this facility profile.</p>
        <p className="text-xs text-slate-400 mt-1">سرجری سروس اس پروفائل میں فعال نہیں ہے۔</p>
      </div>
    );
  }

  const isDecided =
    activeConsent?.status === "Given" ||
    activeConsent?.status === "Refused" ||
    activeConsent?.status === "Withdrawn" ||
    activeConsent?.status === "Cancelled";

  return (
    <div className="space-y-4 p-4 max-w-7xl mx-auto">
      {/* Top Banner & Mode indicator */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              Consents to Anaesthesia
            </h1>
            <span className="text-xs font-urdu text-slate-500 font-medium">
              اینستھیزیا اور جراحی کی باضابطہ رضامندی
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            MSDS COP 31, 32 & Rules e9d9f576df, d84307d9b2, fea5622fc5, b7bacc1ffb, cb2f327ee7
          </p>
        </div>

        {/* Workspace navigation buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            data-help="consents_anaesthesia.tab_worklist_button"
            onClick={() => setActiveTab("worklist")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "worklist"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Consent Worklist / ورک لسٹ ({filteredWorklist.length})
          </button>
          <button
            data-help="consents_anaesthesia.tab_register_button"
            onClick={() => {
              setActiveTab("register");
              loadConsentRegister();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "register"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Consent Register / رجسٹر
          </button>
          <button
            data-help="consents_anaesthesia.refresh_button"
            onClick={() => (activeTab === "register" ? loadConsentRegister() : loadWorklist())}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1"
          >
            <span>↻ Refresh</span>
          </button>
        </div>
      </div>

      {/* Retiring / Capability Banners */}
      {viewMode === "open_work" && (
        <div className="p-3 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg text-xs font-medium">
          ⚠️ Surgery service is retiring. Existing consents may be concluded, but no new operations can be booked.
        </div>
      )}

      {/* Alerts */}
      {errorBanner && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex justify-between items-center">
          <div>
            <p className="font-bold">{errorBanner.en}</p>
            <p className="text-[11px] font-urdu mt-0.5">{errorBanner.ur}</p>
          </div>
          <button
            data-help="consents_anaesthesia.dismiss_alert_button"
            onClick={() => setErrorBanner(null)}
            className="text-rose-500 hover:text-rose-700 font-bold px-2"
          >
            ✕
          </button>
        </div>
      )}

      {successBanner && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex justify-between items-center">
          <div>
            <p className="font-bold">{successBanner.en}</p>
            <p className="text-[11px] font-urdu mt-0.5">{successBanner.ur}</p>
          </div>
          <button
            data-help="consents_anaesthesia.dismiss_alert_button"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-500 hover:text-emerald-700 font-bold px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: CONSENT WORKLIST (Rule e9d9f576df) */}
      {/* ========================================================= */}
      {activeTab === "worklist" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Controls Bar */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  data-help="consents_anaesthesia.filter_mine_toggle"
                  checked={filterMine}
                  onChange={(e) => setFilterMine(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>My patients only / میرے مریض</span>
              </label>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-600 font-medium">Timeframe:</span>
                <select
                  data-help="consents_anaesthesia.filter_days_select"
                  value={filterDays}
                  onChange={(e) => setFilterDays(Number(e.target.value))}
                  className="p-1.5 border rounded-lg bg-white text-slate-800 text-xs font-semibold"
                >
                  <option value={1}>Next 24 Hours</option>
                  <option value={3}>Next 3 Days</option>
                  <option value={7}>Next 7 Days</option>
                  <option value={14}>Next 14 Days</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-600 font-medium">Type:</span>
                <select
                  data-help="consents_anaesthesia.filter_kind_select"
                  value={filterKind}
                  onChange={(e) => setFilterKind(e.target.value)}
                  className="p-1.5 border rounded-lg bg-white text-slate-800 text-xs font-semibold"
                >
                  <option value="all">All Requirements</option>
                  <option value="AnaesthesiaConsent">Anaesthesia Consent</option>
                  <option value="OperationConsent">Operation Consent</option>
                  <option value="GeneralConsent">General Admission Consent</option>
                  <option value="Scan">Signed Forms to Scan</option>
                </select>
              </div>
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                data-help="consents_anaesthesia.search_input"
                placeholder="Search patient, MRN, procedure..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2 text-xs border rounded-lg bg-white text-slate-900"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b uppercase text-[10px] tracking-wider font-bold">
                  <th className="p-3">Status</th>
                  <th className="p-3">Required Consent</th>
                  <th className="p-3">Patient / MRN</th>
                  <th className="p-3">Procedure / Context</th>
                  <th className="p-3">Deadline / Due</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWorklist.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      {loading ? "Loading consent worklist..." : "No pending consents in this timeframe."}
                    </td>
                  </tr>
                ) : (
                  filteredWorklist.map((item, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-50 transition-colors ${
                        item.overdue ? "bg-rose-50/40" : ""
                      }`}
                    >
                      <td className="p-3">
                        {item.overdue ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300">
                            🚨 Overdue
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-semibold text-slate-900">
                        {item.kind === "AnaesthesiaConsent" ? (
                          <span className="text-indigo-700 font-bold">Anaesthesia Consent</span>
                        ) : item.kind === "OperationConsent" ? (
                          <span className="text-emerald-700 font-bold">Operation Consent</span>
                        ) : item.kind === "GeneralConsent" ? (
                          <span className="text-slate-800">General Admission Consent</span>
                        ) : (
                          <span className="text-amber-700 font-bold">Scan Paperwork</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{item.patient_name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{item.mrn}</div>
                      </td>
                      <td className="p-3 text-slate-600">
                        {item.procedure_name || (
                          <span className="text-slate-400 italic">General Admission #{item.admission_number}</span>
                        )}
                        {item.booking_number && (
                          <div className="text-[10px] text-slate-400 font-mono">OT #{item.booking_number}</div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className={`font-medium ${item.overdue ? "text-rose-600 font-bold" : "text-slate-600"}`}>
                          {item.due_at ? new Date(item.due_at).toLocaleString() : "Before surgery"}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          data-help="consents_anaesthesia.worklist_action_button"
                          onClick={() => handleWorklistAction(item)}
                          className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-xs"
                        >
                          {item.consent_id ? "Open Draft / کھولیں" : "Prepare / تیار کریں"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: CONSENT REGISTER */}
      {/* ========================================================= */}
      {activeTab === "register" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-600 font-medium">Filter Status:</span>
              <select
                data-help="consents_anaesthesia.filter_register_status_select"
                value={registerStatusFilter}
                onChange={(e) => setRegisterStatusFilter(e.target.value)}
                className="p-1.5 border rounded-lg bg-white text-slate-800 text-xs font-semibold"
              >
                <option value="all">All Statuses</option>
                <option value="Draft">Draft Only</option>
                <option value="Given">Given / Signed</option>
                <option value="Refused">Refused</option>
                <option value="Withdrawn">Withdrawn</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b uppercase text-[10px] tracking-wider font-bold">
                  <th className="p-3">Consent #</th>
                  <th className="p-3">Form</th>
                  <th className="p-3">Patient / MRN</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Signer</th>
                  <th className="p-3">Decided At</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {consentRegister.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      {loading ? "Loading consent register..." : "No consents found."}
                    </td>
                  </tr>
                ) : (
                  consentRegister.map((c) => (
                    <tr key={c.consent_id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-800">{c.consent_number}</td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">{c.form_title}</div>
                        <div className="text-[10px] text-slate-500">{c.language}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{c.patient_name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{c.mrn}</div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.status === "Given"
                              ? "bg-emerald-100 text-emerald-800"
                              : c.status === "Draft"
                              ? "bg-amber-100 text-amber-800"
                              : c.status === "Refused"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">
                        {c.signer_name ? `${c.signer_name} (${c.signer})` : "-"}
                      </td>
                      <td className="p-3 text-slate-500">
                        {c.decided_at ? new Date(c.decided_at).toLocaleString() : "-"}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          data-help="consents_anaesthesia.inspect_consent_button"
                          onClick={() => loadConsentDetail(c.consent_id)}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
                        >
                          Inspect / معائنہ
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: DETAIL / PREPARATION & SIGNING (Rule d84307d9b2) */}
      {/* ========================================================= */}
      {activeTab === "detail" && activeConsent && (
        <div className="space-y-4">
          {/* Header Card */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-indigo-700">
                  {activeConsent.consent_number}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    activeConsent.status === "Given"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : activeConsent.status === "Draft"
                      ? "bg-amber-50 text-amber-800 border-amber-300"
                      : activeConsent.status === "Refused"
                      ? "bg-rose-50 text-rose-800 border-rose-300"
                      : "bg-slate-50 text-slate-700 border-slate-300"
                  }`}
                >
                  {activeConsent.status}
                </span>
                {activeConsent.document_id && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                    📎 Scanned Paperwork Attached
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                <strong>{activeConsent.patient_name}</strong> • MRN: {activeConsent.mrn} • Age:{" "}
                {activeConsent.patient_age ?? "Unknown"} yrs • S/O: {activeConsent.father_or_husband_name ?? "N/A"}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                data-help="consents_anaesthesia.back_to_list_button"
                onClick={() => setActiveTab("worklist")}
                className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium rounded-lg text-xs"
              >
                ← Back to Worklist
              </button>
              <button
                data-help="consents_anaesthesia.print_button"
                onClick={handleFetchPrint}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
              >
                🖨️ Print Form / پرنٹ
              </button>
              {!isDecided && (
                <>
                  <button
                    data-help="consents_anaesthesia.open_refuse_modal_button"
                    onClick={() => setShowRefuseModal(true)}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg text-xs"
                  >
                    Refuse / انکار
                  </button>
                  <button
                    data-help="consents_anaesthesia.open_sign_modal_button"
                    onClick={() => setShowSignModal(true)}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-sm"
                  >
                    Record Signature / دستخط
                  </button>
                </>
              )}
              {activeConsent.status === "Given" && (
                <>
                  <button
                    data-help="consents_anaesthesia.open_scan_modal_button"
                    onClick={() => setShowScanModal(true)}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg text-xs"
                  >
                    📎 Attach Signed Scan / اسکین
                  </button>
                  <button
                    data-help="consents_anaesthesia.open_withdraw_modal_button"
                    onClick={() => setShowWithdrawModal(true)}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold rounded-lg text-xs"
                  >
                    Withdraw / منسوخ کریں
                  </button>
                </>
              )}
              {activeConsent.status === "Draft" && (
                <button
                  data-help="consents_anaesthesia.open_cancel_modal_button"
                  onClick={() => setShowCancelModal(true)}
                  className="px-3 py-1.5 text-slate-400 hover:text-rose-600 font-medium text-xs"
                >
                  Cancel Draft
                </button>
              )}
            </div>
          </div>

          {/* Missing fields alert banner (Rule d84307d9b2) */}
          {activeConsent.missing && activeConsent.missing.length > 0 && !isDecided && (
            <div className="p-3 bg-amber-50 border border-amber-300 text-amber-800 rounded-xl text-xs space-y-1">
              <p className="font-bold">Required fields missing before signing:</p>
              <ul className="list-disc list-inside text-[11px] space-y-0.5">
                {activeConsent.missing.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 2-Column Preparation & Explanation Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Column: Form Text & Bilingual Declaration (Rule fea5622fc5) */}
            <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200 space-y-3">
              <h2 className="font-bold text-xs uppercase tracking-wide text-slate-800 border-b pb-2">
                Informed Consent Declaration / معلوماتی بیان
              </h2>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-700">Form:</label>
                  <select
                    data-help="consents_anaesthesia.select_form"
                    disabled={isDecided}
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full mt-1 p-2 border rounded-lg bg-white text-xs font-bold"
                  >
                    {forms.map((f) => (
                      <option key={f.code} value={f.code}>
                        {f.title} ({f.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-36">
                  <label className="block text-xs font-semibold text-slate-700">Language:</label>
                  <select
                    data-help="consents_anaesthesia.select_language"
                    disabled={isDecided}
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as any)}
                    className="w-full mt-1 p-2 border rounded-lg bg-white text-xs font-bold"
                  >
                    <option value="Urdu">Urdu (اردو)</option>
                    <option value="English">English</option>
                    <option value="Punjabi">Punjabi (پنجابی)</option>
                    <option value="Pashto">Pashto (پښتو)</option>
                    <option value="Sindhi">Sindhi (سنڌي)</option>
                    <option value="Saraiki">Saraiki (سرائیکی)</option>
                    <option value="Balochi">Balochi (بلوچی)</option>
                  </select>
                </div>
              </div>

              {/* Form Title & Body in Nastaliq font (RTL) */}
              <div
                dir={activeConsent.direction}
                className={`p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2 ${
                  activeConsent.direction === "rtl" ? "font-urdu text-right" : "text-left"
                }`}
              >
                <h3 className="font-bold text-sm text-slate-900 border-b border-slate-200 pb-1">
                  {activeConsent.form_title}
                </h3>
                <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {activeConsent.form_body}
                </div>
              </div>

              {/* Explanation options */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    data-help="consents_anaesthesia.toggle_read_aloud"
                    disabled={isDecided}
                    checked={readToPatient}
                    onChange={(e) => setReadToPatient(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Read aloud to illiterate patient / مریض کو پڑھ کر سنایا گیا</span>
                </label>

                <div>
                  <label className="block text-[11px] text-slate-600">
                    Interpreter Name (if translation required) / مترجم کا نام:
                  </label>
                  <input
                    type="text"
                    data-help="consents_anaesthesia.input_interpreter"
                    disabled={isDecided}
                    value={interpreterName}
                    onChange={(e) => setInterpreterName(e.target.value)}
                    placeholder="e.g. Nurse Fatima (Pashto translation)"
                    className="w-full mt-1 p-1.5 border rounded text-xs bg-white text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Clinical Details, Risks, Benefits, Alternatives */}
            <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200 space-y-3">
              <h2 className="font-bold text-xs uppercase tracking-wide text-slate-800 border-b pb-2">
                Procedure, Risks & Counseling / خطرات اور متبادل
              </h2>

              <div className="text-xs space-y-2.5">
                <div>
                  <label className="block text-slate-700 font-semibold">
                    Procedure Name / سرجری یا پروسیجر:
                  </label>
                  <input
                    type="text"
                    data-help="consents_anaesthesia.input_procedure"
                    disabled={isDecided}
                    value={procedureName}
                    onChange={(e) => setProcedureName(e.target.value)}
                    placeholder="e.g. Laparoscopic Cholecystectomy under General Anaesthesia"
                    className="w-full mt-1 p-2 border rounded-lg bg-white text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold">
                    Performer / Anaesthetist / معالج:
                  </label>
                  <input
                    type="text"
                    data-help="consents_anaesthesia.input_performer"
                    disabled={isDecided}
                    value={performerName}
                    onChange={(e) => setPerformerName(e.target.value)}
                    placeholder="e.g. Dr. Salman Khan (Anaesthetist)"
                    className="w-full mt-1 p-2 border rounded-lg bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold">
                    Identified Risks & Complications / متوقع خطرات:
                  </label>
                  <textarea
                    data-help="consents_anaesthesia.input_risks"
                    disabled={isDecided}
                    value={risks}
                    onChange={(e) => setRisks(e.target.value)}
                    rows={2}
                    placeholder="e.g. Nausea, sore throat, dental trauma, rare allergic reaction, hemodynamic instability"
                    className="w-full mt-1 p-2 border rounded-lg bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold">
                    Expected Benefits / متوقع فوائد:
                  </label>
                  <textarea
                    data-help="consents_anaesthesia.input_benefits"
                    disabled={isDecided}
                    value={benefits}
                    onChange={(e) => setBenefits(e.target.value)}
                    rows={2}
                    placeholder="e.g. Pain-free surgical intervention, controlled muscle relaxation, airway protection"
                    className="w-full mt-1 p-2 border rounded-lg bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold">
                    Treatment Alternatives / متبادل طریقے:
                  </label>
                  <textarea
                    data-help="consents_anaesthesia.input_alternatives"
                    disabled={isDecided}
                    value={alternatives}
                    onChange={(e) => setAlternatives(e.target.value)}
                    rows={2}
                    placeholder="e.g. Spinal anaesthesia, regional nerve block, conscious sedation"
                    className="w-full mt-1 p-2 border rounded-lg bg-white text-slate-900"
                  />
                </div>

                {!isDecided && (
                  <div className="pt-2">
                    <button
                      data-help="consents_anaesthesia.save_draft_button"
                      onClick={handleSaveDraft}
                      disabled={loading}
                      className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs"
                    >
                      💾 Save Consent Draft / ڈرافٹ محفوظ کریں
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SIGN MODAL DIALOG (Rule b7bacc1ffb & Rule cb2f327ee7) */}
      {/* ========================================================= */}
      {showSignModal && activeConsent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Record Informed Consent / باضابطہ دستخط
                </h3>
                <p className="text-xs text-slate-500">
                  Signer authorization checked against server who_decides policy (Rule cb2f327ee7)
                </p>
              </div>
              <button
                data-help="consents_anaesthesia.close_sign_modal_button"
                onClick={() => setShowSignModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Mode: Signed vs EmergencyNote */}
            <div className="flex gap-2 text-xs">
              <label className="flex items-center gap-1.5 font-semibold text-slate-700">
                <span>Mode:</span>
                <select
                  data-help="consents_anaesthesia.select_sign_mode"
                  value={signMode}
                  onChange={(e) => setSignMode(e.target.value as any)}
                  className="p-1.5 border rounded-lg bg-white text-slate-800 font-bold"
                >
                  <option value="Signed">Standard Signed Consent</option>
                  <option value="EmergencyNote">Emergency Note (Treatment cannot wait)</option>
                </select>
              </label>
            </div>

            {signMode === "EmergencyNote" ? (
              <div className="space-y-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs">
                <p className="font-bold text-rose-800">
                  🚨 Emergency Consent: Nobody available to consent and procedure cannot wait.
                </p>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Emergency Clinical Justification:
                  </label>
                  <textarea
                    data-help="consents_anaesthesia.input_emergency_note"
                    value={emergencyNote}
                    onChange={(e) => setEmergencyNote(e.target.value)}
                    rows={3}
                    placeholder="Document acute clinical situation, patient unresponsiveness, immediate risk to life/limb..."
                    className="w-full p-2 border rounded-lg bg-white text-slate-900"
                  />
                </div>

                {activeConsent.who_decides?.emergency_second_doctor && (
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Concurring Second PMDC-Registered Doctor (employee ID):
                    </label>
                    <input
                      type="number"
                      data-help="consents_anaesthesia.select_second_doctor"
                      value={secondDoctorId ?? ""}
                      onChange={(e) => setSecondDoctorId(Number(e.target.value) || null)}
                      placeholder="e.g. 102"
                      className="w-full p-2 border rounded-lg bg-white text-slate-900"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {/* Signer: Patient vs DecisionMaker */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700">Signer Authority:</label>
                    <select
                      data-help="consents_anaesthesia.select_signer_type"
                      value={signerType}
                      onChange={(e) => setSignerType(e.target.value as any)}
                      className="w-full mt-1 p-2 border rounded-lg bg-white text-slate-900 font-bold"
                    >
                      <option
                        value="Patient"
                        disabled={!activeConsent.who_decides?.patient_may_sign}
                      >
                        Patient {!activeConsent.who_decides?.patient_may_sign && "(Minor - Not Allowed)"}
                      </option>
                      <option value="DecisionMaker">Decision Maker / Guardian / سرپرست</option>
                    </select>
                  </div>

                  {signerType === "DecisionMaker" && (
                    <div>
                      <label className="block font-semibold text-slate-700">Relationship (Rule cb2f327ee7):</label>
                      <select
                        data-help="consents_anaesthesia.select_decision_maker_rel"
                        value={signerRelationship}
                        onChange={(e) => setSignerRelationship(e.target.value)}
                        className="w-full mt-1 p-2 border rounded-lg bg-white text-slate-900 font-bold"
                      >
                        {activeConsent.who_decides?.decision_makers.map((dm) => (
                          <option key={dm.relationship} value={dm.relationship}>
                            {dm.description} ({dm.relationship}) - Priority {dm.priority}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {signerType === "DecisionMaker" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-600 font-semibold">Signer Legal Name:</label>
                      <input
                        type="text"
                        data-help="consents_anaesthesia.input_signer_name"
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        placeholder="Full legal name of guardian"
                        className="w-full mt-1 p-2 border rounded-lg bg-white text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold">Incapacity Reason:</label>
                      <select
                        data-help="consents_anaesthesia.select_incapacity_reason"
                        value={incapacityReason}
                        onChange={(e) => setIncapacityReason(e.target.value)}
                        className="w-full mt-1 p-2 border rounded-lg bg-white text-slate-900"
                      >
                        <option value="Minor">Minor under legal age</option>
                        <option value="Unconscious">Unconscious / Sedated</option>
                        <option value="Confused">Confused / Altered Mentation</option>
                        <option value="MentalIllness">Mental Incapacity</option>
                        <option value="Other">Other Medical Incapacity</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600">Signer CNIC / شناختی کارڈ:</label>
                    <input
                      type="text"
                      data-help="consents_anaesthesia.input_signer_cnic"
                      value={signerCnic}
                      onChange={(e) => setSignerCnic(e.target.value)}
                      placeholder="e.g. 35202-1234567-1"
                      className="w-full mt-1 p-2 border rounded-lg bg-white text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600">Signer Phone / فون نمبر:</label>
                    <input
                      type="text"
                      data-help="consents_anaesthesia.input_signer_phone"
                      value={signerPhone}
                      onChange={(e) => setSignerPhone(e.target.value)}
                      placeholder="e.g. 0300-1234567"
                      className="w-full mt-1 p-2 border rounded-lg bg-white text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700">Signature Mark:</label>
                    <select
                      data-help="consents_anaesthesia.select_signer_mark"
                      value={signerMark}
                      onChange={(e) => setSignerMark(e.target.value as any)}
                      className="w-full mt-1 p-2 border rounded-lg bg-white text-slate-900 font-bold"
                    >
                      <option value="Signature">Physical Signature</option>
                      <option value="ThumbImpression">Thumb Impression / انگوٹھے کا نشان</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600">Witness Name (Required for Thumb):</label>
                    <input
                      type="text"
                      data-help="consents_anaesthesia.input_witness_name"
                      value={witnessName}
                      onChange={(e) => setWitnessName(e.target.value)}
                      placeholder="e.g. Nurse Fatima"
                      className="w-full mt-1 p-2 border rounded-lg bg-white text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600">Questions & Answers / سوالات و جوابات:</label>
                  <textarea
                    data-help="consents_anaesthesia.input_questions_answers"
                    value={questionsAnswers}
                    onChange={(e) => setQuestionsAnswers(e.target.value)}
                    rows={2}
                    placeholder="Patient asked regarding recovery time; explained. 'None asked' if none."
                    className="w-full mt-1 p-2 border rounded-lg bg-white text-slate-900"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer font-semibold text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                  <input
                    type="checkbox"
                    data-help="consents_anaesthesia.toggle_understanding_confirmed"
                    checked={understandingConfirmed}
                    onChange={(e) => setUnderstandingConfirmed(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    ✓ The patient (or guardian) explained the procedure back in their own words / مریض نے اپنی زبان میں سمجھ کر تصدیق کی
                  </span>
                </label>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <button
                data-help="consents_anaesthesia.close_sign_modal_button"
                onClick={() => setShowSignModal(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                data-help="consents_anaesthesia.submit_sign_button"
                onClick={handleConfirmSign}
                disabled={loading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-sm"
              >
                ✓ Finalize & Sign Consent (Given)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* REFUSE MODAL DIALOG (Rule b7bacc1ffb) */}
      {/* ========================================================= */}
      {showRefuseModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-rose-800">
                Record Informed Refusal / رضامندی سے انکار
              </h3>
              <button
                data-help="consents_anaesthesia.close_refuse_modal_button"
                onClick={() => setShowRefuseModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold">Refusal Mode:</label>
                <select
                  data-help="consents_anaesthesia.select_refusal_mode"
                  value={refuseMode}
                  onChange={(e) => setRefuseMode(e.target.value as any)}
                  className="w-full mt-1 p-2 border rounded-lg bg-white text-slate-900 font-bold"
                >
                  <option value="Signed">Signed Refusal (Patient/Guardian signed refusal)</option>
                  <option value="VerbalRefusal">Verbal Refusal (Declined to sign; witnessed)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold">
                  Refusal Reason (in patient's own words) / انکار کی وجہ:
                </label>
                <textarea
                  data-help="consents_anaesthesia.input_refusal_reason"
                  value={refuseReason}
                  onChange={(e) => setRefuseReason(e.target.value)}
                  rows={3}
                  placeholder="Record exact reasons patient or family refuses anaesthetic technique..."
                  className="w-full mt-1 p-2 border rounded-lg bg-white text-slate-900"
                />
              </div>

              {refuseMode === "VerbalRefusal" && (
                <div>
                  <label className="block text-slate-700 font-semibold">
                    Witness Name (Mandatory for verbal refusal):
                  </label>
                  <input
                    type="text"
                    data-help="consents_anaesthesia.input_refusal_witness"
                    value={refuseWitness}
                    onChange={(e) => setRefuseWitness(e.target.value)}
                    placeholder="e.g. Staff Nurse Aisha"
                    className="w-full mt-1 p-2 border rounded-lg bg-white text-slate-900"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <button
                data-help="consents_anaesthesia.close_refuse_modal_button"
                onClick={() => setShowRefuseModal(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 text-xs font-medium"
              >
                Back
              </button>
              <button
                data-help="consents_anaesthesia.submit_refuse_button"
                onClick={handleConfirmRefuse}
                disabled={loading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs"
              >
                Record Refusal / انکار محفوظ کریں
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* WITHDRAW MODAL DIALOG (Rule 8b7301ca0f) */}
      {/* ========================================================= */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-amber-800">
                Withdraw Consent / رضامندی کی تنسیخ
              </h3>
              <button
                data-help="consents_anaesthesia.close_withdraw_modal_button"
                onClick={() => setShowWithdrawModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                A finalized consent is permanent. Withdrawing it invalidates the current clearance and marks it Withdrawn. A new consent must be taken.
              </p>
              <div>
                <label className="block text-slate-700 font-semibold">
                  Withdrawal Reason / منسوخی کا سبب:
                </label>
                <textarea
                  data-help="consents_anaesthesia.input_withdraw_reason"
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  rows={3}
                  placeholder="Clinical reason or patient change of mind..."
                  className="w-full mt-1 p-2 border rounded-lg bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <button
                data-help="consents_anaesthesia.close_withdraw_modal_button"
                onClick={() => setShowWithdrawModal(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 text-xs font-medium"
              >
                Back
              </button>
              <button
                data-help="consents_anaesthesia.submit_withdraw_button"
                onClick={handleConfirmWithdraw}
                disabled={loading}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs"
              >
                Confirm Withdrawal / منسوخ کریں
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* CANCEL MODAL DIALOG */}
      {/* ========================================================= */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-slate-800">
                Cancel Draft Consent / ڈرافٹ کینسل کریں
              </h3>
              <button
                data-help="consents_anaesthesia.close_cancel_modal_button"
                onClick={() => setShowCancelModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold">
                  Cancellation Reason:
                </label>
                <input
                  type="text"
                  data-help="consents_anaesthesia.input_cancel_reason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Procedure cancelled by surgeon"
                  className="w-full mt-1 p-2 border rounded-lg bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <button
                data-help="consents_anaesthesia.close_cancel_modal_button"
                onClick={() => setShowCancelModal(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 text-xs font-medium"
              >
                Back
              </button>
              <button
                data-help="consents_anaesthesia.submit_cancel_button"
                onClick={handleConfirmCancel}
                disabled={loading}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg text-xs"
              >
                Cancel Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SCAN UPLOAD MODAL (Rule 8b7301ca0f) */}
      {/* ========================================================= */}
      {showScanModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-blue-800">
                Attach Scanned Consent Paperwork / اسکین منسلک کریں
              </h3>
              <button
                data-help="consents_anaesthesia.close_scan_modal_button"
                onClick={() => setShowScanModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Upload the physical document signed by the patient or guardian (PDF, JPEG, or PNG).
              </p>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Document Title:
                </label>
                <input
                  type="text"
                  data-help="consents_anaesthesia.input_scan_title"
                  value={scanTitle}
                  onChange={(e) => setScanTitle(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Select File:
                </label>
                <input
                  type="file"
                  data-help="consents_anaesthesia.file_scan_input"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={(e) => setScanFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <button
                data-help="consents_anaesthesia.close_scan_modal_button"
                onClick={() => setShowScanModal(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                data-help="consents_anaesthesia.submit_scan_button"
                onClick={handleConfirmScan}
                disabled={loading || !scanFile}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs"
              >
                Upload & Attach Scan / فائل منسلک کریں
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PRINT PAYLOAD PREVIEW MODAL (Rule fea5622fc5) */}
      {/* ========================================================= */}
      {printPayload && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-slate-900">
                Consent Document Print Preview / پرنٹ کا پیش نظارہ
              </h3>
              <button
                data-help="consents_anaesthesia.close_print_modal_button"
                onClick={() => setPrintPayload(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Document layout */}
            <div className="p-6 border border-slate-300 rounded-lg bg-white space-y-4 text-xs font-serif text-slate-900">
              <div className="text-center border-b pb-3 space-y-1">
                <h1 className="text-base font-bold uppercase tracking-wider">
                  {printPayload.fields.hospital.name}
                </h1>
                <p className="text-[11px] text-slate-600">{printPayload.fields.hospital.address}</p>
                <p className="text-[10px] text-slate-500">PHC Reg: {printPayload.fields.hospital.phc_number}</p>
                <p className="text-[10px] text-slate-400 italic">{printPayload.fields.hospital.issue_line}</p>
              </div>

              <div
                dir={printPayload.fields.consent.direction}
                className={`space-y-2 ${
                  printPayload.fields.consent.direction === "rtl" ? "font-urdu text-right" : "text-left"
                }`}
              >
                <h2 className="text-sm font-bold border-b pb-1">
                  {printPayload.fields.consent.form_title}
                </h2>
                <div className="whitespace-pre-wrap leading-relaxed text-slate-800">
                  {printPayload.fields.consent.form_body}
                </div>
              </div>

              {/* Explained items */}
              {printPayload.fields.explained && printPayload.fields.explained.length > 0 && (
                <div className="border-t pt-2 space-y-1">
                  <h4 className="font-bold text-[11px] uppercase text-slate-700">Clinical Explanation:</h4>
                  {printPayload.fields.explained.map((line, idx) => (
                    <div key={idx} className="flex justify-between text-[11px]">
                      <span className="font-semibold text-slate-600">{line.label}:</span>
                      <span className="text-slate-800">{line.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Decision or Signature lines */}
              <div className="border-t pt-3">
                {printPayload.fields.decision && printPayload.fields.decision.length > 0 ? (
                  <div className="space-y-1">
                    <h4 className="font-bold text-[11px] uppercase text-slate-700">Recorded Decision:</h4>
                    {printPayload.fields.decision.map((line, idx) => (
                      <div key={idx} className="flex justify-between text-[11px]">
                        <span className="font-semibold text-slate-600">{line.label}:</span>
                        <span className="text-slate-800">{line.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-6 pt-4">
                    {printPayload.fields.signature_lines.map((sig, idx) => (
                      <div key={idx} className="flex justify-between items-end border-b border-dashed pb-1">
                        <span className="text-[11px] font-semibold text-slate-700">{sig}</span>
                        <span className="text-[10px] text-slate-400 italic">Signature / Thumb</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <button
                data-help="consents_anaesthesia.close_print_modal_button"
                onClick={() => setPrintPayload(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
