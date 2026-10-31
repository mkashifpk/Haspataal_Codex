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
  NewbornIn,
  NewbornRegisteredOut,
  NewbornOut,
  WristbandIn,
  WristbandIssuedOut,
  IdentityVerifyOut,
} from "../generated/newborn_registration";
import {
  registerNewborn,
  newborns,
  issueWristband,
  verifyWristband,
} from "../generated/newborn_registration";
import {
  getNewbornRegistrationScreenView,
  isMaternityActive,
  validateNewbornInput,
  validateReplacementWristbandInput,
  formatNewbornLabel,
  explainNewbornError,
} from "../newborn-registration-policy";
import { useClinicalWrite, ClinicalWriteFeedback, type ClinicalCommand } from "../clinical-write";
import { api, call } from "../bridge";

export interface NewbornRegistrationProps {
  user: ClinicalUser;
  establishment?: EstablishmentOut | null;
  connected?: boolean;
  stream?: string | null;
  initialAdmissionId?: number | null;
  onNavigateScreen?: (screen: string) => void;
}

interface AdmittedMotherSearchMatch {
  admission_id: number;
  admission_number: string;
  patient_id: number;
  mrn: string;
  name: string;
  gender: string;
  age_years?: number | null;
  mobile?: string | null;
  ward_name?: string | null;
  bed_label?: string | null;
}

export function NewbornRegistration({
  user,
  establishment: propEstablishment,
  connected = true,
  stream = null,
  initialAdmissionId = null,
  onNavigateScreen,
}: NewbornRegistrationProps) {
  // Permissions check
  const canRecord =
    (user.permissions?.includes("maternity.record") ?? false) &&
    (user.permissions?.includes("patient.wristband.print") ?? false);
  const canView = user.permissions?.includes("maternity.view") ?? false;
  const canPrintWristband = user.permissions?.includes("patient.wristband.print") ?? false;

  // Real-time revision tracking
  const [revision, setRevision] = useState(0);
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);

  // Active Establishment state
  const [est, setEst] = useState<EstablishmentOut | null>(propEstablishment || null);
  useEffect(() => {
    if (propEstablishment) setEst(propEstablishment);
  }, [propEstablishment]);

  // Screen view mode
  const screenView = getNewbornRegistrationScreenView(est);
  const maternityActive = isMaternityActive(est);

  // Active Tab: "register" (Bedside Registration) or "register_log" (Newborns Register)
  const [activeTab, setActiveTab] = useState<"register" | "register_log">("register");

  // Mother Selection State
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<number | null>(initialAdmissionId || 1);
  const [motherQuery, setMotherQuery] = useState("");
  const [motherSearching, setMotherSearching] = useState(false);
  const [motherSearchResults, setMotherSearchResults] = useState<AdmittedMotherSearchMatch[]>([]);
  const [motherSearchError, setMotherSearchError] = useState<string | null>(null);
  const [selectedMother, setSelectedMother] = useState<AdmittedMotherSearchMatch | null>(null);

  // Registration Form State (rule:c4dcf395e2)
  const [birthDateTime, setBirthDateTime] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [gender, setGender] = useState<"female" | "male" | "other" | "unknown">("female");
  const [regValidationError, setRegValidationError] = useState<string | null>(null);

  // Recently Registered Baby State (for immediate wristband printing display)
  const [recentlyRegistered, setRecentlyRegistered] = useState<NewbornRegisteredOut | null>(null);

  // Replacement Wristband Modal State (rule:695cc4d1de)
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [replaceTargetBaby, setReplaceTargetBaby] = useState<NewbornOut | null>(null);
  const [replacementReason, setReplacementReason] = useState<string>("Band damaged / torn");
  const [customReplaceReason, setCustomReplaceReason] = useState<string>("");
  const [replaceValidationError, setReplaceValidationError] = useState<string | null>(null);

  // Wristband Scanner / Verification Modal State
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [scanCode, setScanCode] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<IdentityVerifyOut | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Newborns Register Query Filters
  const [filterDateFrom, setFilterDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [filterDateTo, setFilterDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [filterOnlySelectedMother, setFilterOnlySelectedMother] = useState(false);

  // Load Newborns Register
  const newbornsLoad = useLoad<NewbornOut[]>(
    async () => {
      const q: {
        mother_patient_id?: number | null;
        date_from?: string | null;
        date_to?: string | null;
        limit?: number;
      } = {
        limit: 100,
      };

      if (filterOnlySelectedMother && selectedMother?.patient_id) {
        q.mother_patient_id = selectedMother.patient_id;
      } else {
        q.date_from = filterDateFrom;
        q.date_to = filterDateTo;
      }

      const res = await newborns(q);
      return res;
    },
    [filterDateFrom, filterDateTo, filterOnlySelectedMother, selectedMother?.patient_id, revision]
  );

  // Real-time Event Subscription
  useEffect(() => {
    if (!stream) return;
    try {
      const parsed = JSON.parse(stream);
      const ev = parsed.event || parsed.topic;
      if (ev === "establishment.changed") {
        setRealtimeNotice(
          t(
            "Establishment configuration changed. Maternity service status refreshed.",
            "ادارے کی سیٹنگز تبدیل ہوئیں۔ زچگی سروس کی حیثیت تازہ کر دی گئی ہے۔"
          )
        );
        setRevision((r) => r + 1);
      }
    } catch {
      // ignore
    }
  }, [stream]);

  // Clinical write controller
  const write = useClinicalWrite(user, "newborn_registration", (value: any, cmd: ClinicalCommand) => {
    setRevision((r) => r + 1);
    if (cmd.path.includes("/maternity/newborns")) {
      const registered = value as NewbornRegisteredOut;
      setRecentlyRegistered(registered);
      setRegValidationError(null);
    } else if (cmd.path.includes("/wristbands")) {
      setReplaceModalOpen(false);
      setReplaceTargetBaby(null);
      setCustomReplaceReason("");
      setReplaceValidationError(null);
    }
  });

  // Search mother admissions
  const handleSearchMother = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!motherQuery.trim()) return;
    setMotherSearching(true);
    setMotherSearchError(null);
    try {
      const q = encodeURIComponent(motherQuery.trim());
      const res = await api<{ data: AdmittedMotherSearchMatch[] }>("GET", `/admissions?q=${q}&status=Admitted&limit=10`);
      const list = res.data || (Array.isArray(res) ? (res as any) : []);
      setMotherSearchResults(list);
      if (list.length === 0) {
        setMotherSearchError(t("No admitted female patients found matching query.", "کوئی داخل شدہ خاتون مریضہ نہیں ملی۔"));
      }
    } catch (err: any) {
      setMotherSearchError(err?.message || "Search failed");
    } finally {
      setMotherSearching(false);
    }
  };

  // Select Mother
  const handleSelectMother = (m: AdmittedMotherSearchMatch) => {
    setSelectedAdmissionId(m.admission_id);
    setSelectedMother(m);
    setMotherSearchResults([]);
    setMotherQuery("");
  };

  // Submit Newborn Registration (POST /maternity/newborns)
  const handleSubmitRegistration = () => {
    if (!selectedAdmissionId) {
      setRegValidationError(t("Please select or enter the mother's admission ID.", "براہ کرم والدہ کا داخلہ نمبر منتخب یا درج کریں۔"));
      return;
    }

    const payload: NewbornIn = {
      admission_id: selectedAdmissionId,
      born_at: new Date(birthDateTime).toISOString(),
      gender: gender,
    };

    const val = validateNewbornInput(payload);
    if (!val.valid) {
      setRegValidationError(val.error || "Validation error");
      return;
    }
    setRegValidationError(null);

    write.start({
      path: "/maternity/newborns",
      method: "POST",
      body: payload,
      permission: "maternity.record",
      protection: "idempotent",
      label: t("Register Newborn & Issue Wristband", "نوزائیدہ کا اندراج اور کلائی بینڈ کا اجراء"),
    });
  };

  // Open Replacement Wristband Modal (rule:695cc4d1de)
  const openReplacementModal = (baby: NewbornOut) => {
    setReplaceTargetBaby(baby);
    setReplacementReason("Band damaged / torn");
    setCustomReplaceReason("");
    setReplaceValidationError(null);
    setReplaceModalOpen(true);
  };

  // Submit Replacement Wristband (POST /wristbands)
  const handleSubmitReplacementWristband = () => {
    if (!replaceTargetBaby) return;

    const finalReason = replacementReason === "Other" ? customReplaceReason.trim() : replacementReason;

    const payload: WristbandIn = {
      admission_id: replaceTargetBaby.birth_admission_id,
      newborn_patient_id: replaceTargetBaby.patient_id,
      replacement_reason: finalReason,
    };

    const val = validateReplacementWristbandInput(payload);
    if (!val.valid) {
      setReplaceValidationError(val.error || "Validation error");
      return;
    }
    setReplaceValidationError(null);

    write.start({
      path: "/wristbands",
      method: "POST",
      body: payload,
      permission: "patient.wristband.print",
      protection: "idempotent",
      label: t("Print Replacement Newborn Wristband", "نوزائیدہ کا متبادل کلائی بینڈ جاری کریں"),
    });
  };

  // Scan & Verify Wristband Barcode
  const handleScanVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!scanCode.trim()) return;
    setScanLoading(true);
    setScanError(null);
    setVerifyResult(null);
    try {
      const res = await verifyWristband({
        code: scanCode.trim(),
        admission_id: selectedAdmissionId || undefined,
      });
      setVerifyResult(res);
    } catch (err: any) {
      setScanError(err?.message || "Wristband verification scan failed");
    } finally {
      setScanLoading(false);
    }
  };

  // Print wristband to label printer
  const handlePrintWristband = async (wbText?: string | null) => {
    try {
      if (window.terminal) {
        await call("print-wristband", {
          text: wbText || undefined,
        });
      } else {
        window.print();
      }
    } catch {
      window.print();
    }
  };

  return (
    <section className="p-4 max-w-7xl mx-auto space-y-4">
      {/* Header and Capability Status */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-700 pb-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <span>👶</span>
            <span>{t("Newborn Registration & Identification", "نوزائیدہ کا اندراج اور کلائی بینڈ")}</span>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              MSDS Cat I 30, II C 69
            </span>
          </h1>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {t(
              "Register baby at mother's bedside, assign unique MRN ('Baby of' mother), and immediately print identity wristband.",
              "والدہ کے بیڈ سائیڈ پر بچے کا فوری اندراج، الگ ایم آر این ('Baby of' نام) اور شناختی کلائی بینڈ کا فوری پرنٹ۔"
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
            onClick={() => setVerifyModalOpen(true)}
            className="px-3 py-1.5 text-xs bg-purple-50 dark:bg-purple-950 hover:bg-purple-100 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 rounded border border-purple-200 dark:border-purple-800 flex items-center gap-1.5 font-medium"
            data-help="newborn_registration.btn_open_verify_modal"
          >
            <span>🔍</span>
            <span>{t("Scan / Verify Band", "کلائی بینڈ اسکین کریں")}</span>
          </button>

          <button
            onClick={() => setRevision((r) => r + 1)}
            className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 flex items-center gap-1.5"
            data-help="newborn_registration.refresh_btn"
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
            data-help="newborn_registration.btn_dismiss_alert"
          >
            {t("Dismiss", "ختم کریں")}
          </button>
        </div>
      )}

      {/* Capability View Gates (rule:0b0674e405) */}
      {screenView === "open_work" && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-lg text-xs text-amber-900 dark:text-amber-200">
          <strong>{t("Notice: ", "انتباہ: ")}</strong>
          {t(
            "No new newborn registrations from now on (Maternity service is Retiring). Existing newborn bands and records remain accessible.",
            "اب سے نوزائیدہ بچوں کے نئے اندراج بند ہیں (زچگی سروس ریٹائر ہو رہی ہے)۔ سابقہ بچوں کے بینڈز اور ریکارڈز دستیاب ہیں۔"
          )}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 gap-1 text-sm">
        <button
          onClick={() => setActiveTab("register")}
          className={`px-4 py-2 font-medium border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === "register"
              ? "border-purple-600 text-purple-700 dark:text-purple-300 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
          data-help="newborn_registration.tab_register_btn"
        >
          <span>🍼</span>
          <span>{t("Bedside Newborn Registration", "بیڈ سائیڈ نوزائیدہ اندراج")}</span>
        </button>

        <button
          onClick={() => setActiveTab("register_log")}
          className={`px-4 py-2 font-medium border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === "register_log"
              ? "border-purple-600 text-purple-700 dark:text-purple-300 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
          data-help="newborn_registration.tab_register_log_btn"
        >
          <span>📋</span>
          <span>{t("Newborns Register Log", "نوزائیدہ بچوں کا رجسٹر")}</span>
          {newbornsLoad.data && newbornsLoad.data.length > 0 && (
            <span className="px-1.5 py-0.2 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full">
              {newbornsLoad.data.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: BEDSIDE NEWBORN REGISTRATION */}
      {activeTab === "register" && (
        <div className="space-y-4">
          {/* RECENTLY REGISTERED SUCCESS CARD WITH WRISTBAND PRINT (rule:c4dcf395e2) */}
          {recentlyRegistered && (
            <div className="p-4 bg-green-50 dark:bg-green-950/40 border-2 border-green-500 rounded-lg space-y-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-green-200 dark:border-green-800 pb-2">
                <div className="flex items-center gap-2 text-green-900 dark:text-green-200 font-bold text-sm">
                  <span>🎉</span>
                  <span>{t("Newborn Successfully Registered!", "نوزائیدہ بچہ کامیابی سے رجسٹر ہو گیا!")}</span>
                </div>
                <button
                  onClick={() => setRecentlyRegistered(null)}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  data-help="newborn_registration.btn_dismiss_success"
                >
                  ✕ {t("Dismiss", "بند کریں")}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-gray-500">{t("Newborn Name:", "بچے کا نام:")}</span>
                  <div className="font-bold text-gray-900 dark:text-gray-100 text-sm">{recentlyRegistered.full_name}</div>
                </div>
                <div>
                  <span className="text-gray-500">{t("Newborn MRN:", "بچے کا ایم آر این:")}</span>
                  <div className="font-mono font-bold text-purple-700 dark:text-purple-300 text-sm">{recentlyRegistered.mrn}</div>
                </div>
                <div>
                  <span className="text-gray-500">{t("Mother's Name & MRN:", "والدہ کا نام و ایم آر این:")}</span>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {recentlyRegistered.mother_name} ({recentlyRegistered.mother_mrn})
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">{t("Time of Birth:", "پیدائش کا وقت:")}</span>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {new Date(recentlyRegistered.born_at).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Immediate Wristband Ready-to-Print Notice */}
              <div className="p-3 bg-white dark:bg-gray-900 rounded border border-green-300 dark:border-green-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🏷️</span>
                  <div>
                    <div className="font-bold text-gray-900 dark:text-gray-100">
                      {t("Identity Wristband Issued on Mother's Admission", "والدہ کے داخلے پر شناختی کلائی بینڈ جاری ہو گیا")}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400">
                      Band #{recentlyRegistered.wristband.wristband.wristband_id} · {t("Print immediately and attach to newborn's ankle/wrist.", "فوری پرنٹ کر کے بچے کے ٹخنے یا کلائی پر باندھیں۔")}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePrintWristband(recentlyRegistered.wristband.print.text)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded shadow-sm flex items-center gap-1.5 cursor-pointer"
                    data-help="newborn_registration.btn_print_issued_band"
                  >
                    <span>🖨️</span>
                    <span>{t("Print Band Now", "کلائی بینڈ پرنٹ کریں")}</span>
                  </button>

                  {onNavigateScreen && (
                    <button
                      onClick={() => onNavigateScreen("labour_register")}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded text-xs flex items-center gap-1.5"
                      data-help="newborn_registration.btn_goto_labour_register"
                    >
                      <span>📜</span>
                      <span>{t("Labour Register (rule:55a7f06927)", "لیبر رجسٹر کھولیں")}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MOTHER ADMISSION SELECTION */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
              <span>👩</span>
              <span>{t("Mother's Current Admission & Bed Context", "والدہ کا داخلہ اور بیڈ کی تفصیل")}</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Manual Admission ID input */}
              <Field label={t("Mother's Inpatient Admission ID (Required)", "والدہ کا داخلہ نمبر (لازمی)")}>
                <input
                  type="number"
                  placeholder="e.g. 42"
                  value={selectedAdmissionId || ""}
                  onChange={(e) => setSelectedAdmissionId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                  data-help="newborn_registration.admission_id_input"
                />
              </Field>

              {/* Or Search Admitted Mother */}
              <Field label={t("Or Search Admitted Mother (MRN or Name)", "یا داخل شدہ والدہ کو تلاش کریں")}>
                <form onSubmit={handleSearchMother} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search mother..."
                    value={motherQuery}
                    onChange={(e) => setMotherQuery(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                    data-help="newborn_registration.mother_search_input"
                  />
                  <button
                    type="submit"
                    disabled={motherSearching}
                    className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded font-medium disabled:opacity-50"
                    data-help="newborn_registration.mother_search_btn"
                  >
                    {motherSearching ? t("Searching...", "تلاش جاری...") : t("Search", "تلاش")}
                  </button>
                </form>
              </Field>
            </div>

            {motherSearchError && <ErrorBox error={motherSearchError} />}

            {/* Mother Search Results */}
            {motherSearchResults.length > 0 && (
              <div className="border border-purple-200 dark:border-purple-800 rounded p-2 bg-purple-50/50 dark:bg-purple-950/20 space-y-1">
                <div className="text-xs font-semibold text-purple-900 dark:text-purple-200 px-1">
                  {t("Select Admitted Mother:", "داخل شدہ والدہ کا انتخاب کریں:")}
                </div>
                {motherSearchResults.map((m) => (
                  <button
                    type="button"
                    key={m.admission_id}
                    onClick={() => handleSelectMother(m)}
                    className="w-full flex items-center justify-between p-2 rounded hover:bg-white dark:hover:bg-gray-900 cursor-pointer text-xs border border-transparent hover:border-purple-300 transition-colors text-left"
                    data-help="newborn_registration.mother_search_match"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-purple-700 dark:text-purple-400">ADM #{m.admission_id}</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{m.name}</span>
                      <span className="text-gray-500">({m.mrn})</span>
                    </div>
                    <span className="text-gray-600 dark:text-gray-400">{m.ward_name || "Ward"} - {m.bed_label || "Bed"}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Active Selected Mother Card */}
            {selectedMother && (
              <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <span className="text-gray-500">{t("Mother Name:", "والدہ کا نام:")}</span>
                  <div className="font-bold text-gray-900 dark:text-gray-100">{selectedMother.name}</div>
                </div>
                <div>
                  <span className="text-gray-500">{t("Mother MRN:", "ایم آر این:")}</span>
                  <div className="font-mono text-gray-900 dark:text-gray-100">{selectedMother.mrn}</div>
                </div>
                <div>
                  <span className="text-gray-500">{t("Ward / Bed:", "وارڈ / بستر:")}</span>
                  <div className="text-gray-900 dark:text-gray-100">{selectedMother.ward_name || "—"} / {selectedMother.bed_label || "—"}</div>
                </div>
                <div>
                  <span className="text-gray-500">{t("Mobile Contact (Decision 61):", "موبائل رابطہ:")}</span>
                  <div className="font-mono text-gray-900 dark:text-gray-100">
                    {selectedMother.mobile || <span className="text-gray-400 italic">{t("Empty (Unidentified)", "خالی")}</span>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* BIRTH REGISTRATION FORM (rule:c4dcf395e2) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
              <span>⏱️</span>
              <span>{t("Birth Details (Mandatory)", "پیدائش کی تفصیلات (لازمی)")}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <Field label={t("Date & Time of Birth (Cannot be in the future)", "پیدائش کی تاریخ اور درست وقت")}>
                <input
                  type="datetime-local"
                  value={birthDateTime}
                  onChange={(e) => setBirthDateTime(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs font-mono"
                  data-help="newborn_registration.birth_time_input"
                />
              </Field>

              <Field label={t("Biological Sex of Newborn", "بچے کی جنس")}>
                <div className="grid grid-cols-4 gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setGender("female")}
                    className={`py-2 px-2 rounded border text-xs font-bold capitalize transition-all ${
                      gender === "female"
                        ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                        : "bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50"
                    }`}
                    data-help="newborn_registration.gender_btn_female"
                  >
                    👧 {t("Female", "لڑکی")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender("male")}
                    className={`py-2 px-2 rounded border text-xs font-bold capitalize transition-all ${
                      gender === "male"
                        ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                        : "bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50"
                    }`}
                    data-help="newborn_registration.gender_btn_male"
                  >
                    👦 {t("Male", "لڑکا")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender("other")}
                    className={`py-2 px-2 rounded border text-xs font-bold capitalize transition-all ${
                      gender === "other"
                        ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                        : "bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50"
                    }`}
                    data-help="newborn_registration.gender_btn_other"
                  >
                    {t("Other", "دیگر")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender("unknown")}
                    className={`py-2 px-2 rounded border text-xs font-bold capitalize transition-all ${
                      gender === "unknown"
                        ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                        : "bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50"
                    }`}
                    data-help="newborn_registration.gender_btn_unknown"
                  >
                    {t("Unknown", "نامعلوم")}
                  </button>
                </div>
              </Field>
            </div>

            {/* Validation & Feedback */}
            {regValidationError && <ErrorBox error={regValidationError} />}
            <ClinicalWriteFeedback write={write} />

            {/* Submit Action */}
            <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="text-[11px] text-gray-500">
                {t(
                  "Submits Idempotency-Key. Generates permanent newborn record and ready-to-print wristband.",
                  "خودکار آئیڈیمپوٹینسی کی کے ذریعے نوزائیدہ کا مستقل ریکارڈ اور فوری پرنٹ کے لیے کلائی بینڈ بناتا ہے۔"
                )}
              </div>

              <button
                type="button"
                onClick={handleSubmitRegistration}
                disabled={write.busy || !canRecord || !maternityActive || screenView === "records" || screenView === "open_work"}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-2"
                data-help="newborn_registration.submit_newborn_btn"
              >
                <span>🏷️</span>
                <span>{write.busy ? t("Registering Baby...", "اندراج جاری ہے...") : t("Register Baby & Print Band", "بچہ رجسٹر کریں اور بینڈ پرنٹ کریں")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: NEWBORNS REGISTER LOG */}
      {activeTab === "register_log" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                <span>📋</span>
                <span>{t("Hospital Newborns Delivery Register", "ہسپتال کا نوزائیدہ بچوں کا رجسٹر")}</span>
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                {t(
                  "All babies delivered in the hospital. Shows baby MRN, birth admission, mother details, and band replacement status.",
                  "ہسپتال میں پیدا ہونے والے تمام بچوں کا ریکارڈ، ایم آر این، داخلہ نمبر اور کلائی بینڈ کی تفصیلات۔"
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                <span>{t("From:", "از:")}</span>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                  data-help="newborn_registration.filter_date_from"
                />
              </label>

              <label className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                <span>{t("To:", "تا:")}</span>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                  data-help="newborn_registration.filter_date_to"
                />
              </label>

              {selectedMother && (
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterOnlySelectedMother}
                    onChange={(e) => setFilterOnlySelectedMother(e.target.checked)}
                    className="rounded text-purple-600"
                    data-help="newborn_registration.filter_only_mother"
                  />
                  <span>{t("Only Selected Mother", "صرف منتخب والدہ")}</span>
                </label>
              )}

              <button
                onClick={() => setRevision((r) => r + 1)}
                className="px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded border border-gray-300 dark:border-gray-600"
                data-help="newborn_registration.refresh_register_btn"
              >
                {t("Refresh Log", "تازہ کریں")}
              </button>
            </div>
          </div>

          {newbornsLoad.loading ? (
            <LoadState
              loading={newbornsLoad.loading}
              error={newbornsLoad.error}
              retry={newbornsLoad.reload}
            />
          ) : newbornsLoad.error ? (
            <ErrorBox error={newbornsLoad.error} />
          ) : !newbornsLoad.data || newbornsLoad.data.length === 0 ? (
            <Empty>
              {t("No newborns recorded for the selected period.", "منتخب مدت کے دوران کوئی نوزائیدہ بچہ ریکارڈ نہیں ہوا۔")}
            </Empty>
          ) : (
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                  <tr>
                    <th className="p-2.5 font-semibold">{t("Baby Name & MRN", "بچے کا نام و ایم آر این")}</th>
                    <th className="p-2.5 font-semibold">{t("Sex", "جنس")}</th>
                    <th className="p-2.5 font-semibold">{t("Born At", "پیدائش")}</th>
                    <th className="p-2.5 font-semibold">{t("Mother Particulars", "والدہ کے کوائف")}</th>
                    <th className="p-2.5 font-semibold">{t("Admission #", "داخلہ نمبر")}</th>
                    <th className="p-2.5 font-semibold text-right">{t("Wristband Actions", "کلائی بینڈ اقدامات")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {newbornsLoad.data.map((baby) => (
                    <tr key={baby.patient_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="p-2.5 font-medium text-gray-900 dark:text-gray-100">
                        <div>{baby.full_name}</div>
                        <div className="font-mono text-purple-700 dark:text-purple-400 text-[11px]">{baby.mrn}</div>
                      </td>
                      <td className="p-2.5 capitalize">{baby.gender || "—"}</td>
                      <td className="p-2.5 text-gray-600 dark:text-gray-400">
                        {new Date(baby.born_at).toLocaleString()}
                      </td>
                      <td className="p-2.5">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{baby.mother_name}</div>
                        <div className="text-[11px] text-gray-500 font-mono">{baby.mother_mrn}</div>
                      </td>
                      <td className="p-2.5 font-mono text-gray-700 dark:text-gray-300">
                        {baby.admission_number || `ADM #${baby.birth_admission_id}`}
                      </td>
                      <td className="p-2.5 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => openReplacementModal(baby)}
                          disabled={!canPrintWristband}
                          className="px-2.5 py-1 text-xs bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200 hover:bg-amber-100 rounded border border-amber-300 dark:border-amber-800 font-medium disabled:opacity-50"
                          data-help="newborn_registration.btn_replace_band"
                        >
                          🏷️ {t("New Band (rule:695cc4d1de)", "نیا بینڈ")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: REPLACEMENT WRISTBAND (rule:695cc4d1de) */}
      {replaceModalOpen && replaceTargetBaby && (
        <Modal
          title={t("Issue Replacement Wristband for Newborn", "نوزائیدہ کے لیے متبادل کلائی بینڈ جاری کریں")}
          onClose={() => setReplaceModalOpen(false)}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 space-y-1">
              <div className="font-bold text-gray-900 dark:text-gray-100">{replaceTargetBaby.full_name}</div>
              <div className="text-gray-600 dark:text-gray-400">
                MRN: <span className="font-mono">{replaceTargetBaby.mrn}</span> · Mother: {replaceTargetBaby.mother_name} (ADM #{replaceTargetBaby.birth_admission_id})
              </div>
            </div>

            <Field label={t("Reason for Wristband Replacement (Mandatory)", "کلائی بینڈ تبدیل کرنے کی وجہ (لازمی)")}>
              <select
                value={replacementReason}
                onChange={(e) => setReplacementReason(e.target.value)}
                className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                data-help="newborn_registration.replace_reason_select"
              >
                <option value="Band damaged / torn">{t("Band damaged / torn", "بینڈ پھٹ گیا / خراب ہو گیا")}</option>
                <option value="Band soiled during care / bathing">{t("Band soiled during care / bathing", "دیکھ بھال کے دوران بینڈ میلا ہو گیا")}</option>
                <option value="Band fell off / loose">{t("Band fell off / loose", "بینڈ کھل کر گر گیا")}</option>
                <option value="Barcode unreadable / scratched">{t("Barcode unreadable / scratched", "بارکوڈ مٹ گیا / اسکین نہیں ہو رہا")}</option>
                <option value="Other">{t("Other clinical reason...", "دیگر طبی وجہ...")}</option>
              </select>
            </Field>

            {replacementReason === "Other" && (
              <Field label={t("Specific Replacement Reason Note", "تفصیلی وجہ لکھیں")}>
                <input
                  type="text"
                  value={customReplaceReason}
                  onChange={(e) => setCustomReplaceReason(e.target.value)}
                  placeholder="Specify reason..."
                  className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                  data-help="newborn_registration.custom_replace_reason_input"
                />
              </Field>
            )}

            {replaceValidationError && <ErrorBox error={replaceValidationError} />}

            <ClinicalWriteFeedback write={write} />

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setReplaceModalOpen(false)}
                className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50"
                data-help="newborn_registration.btn_cancel_replace"
              >
                {t("Cancel", "منسوخ")}
              </button>

              <button
                type="button"
                onClick={handleSubmitReplacementWristband}
                disabled={write.busy}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded cursor-pointer disabled:opacity-50"
                data-help="newborn_registration.submit_replace_band_btn"
              >
                {t("Issue Replacement Band", "متبادل بینڈ جاری کریں")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: SCAN & VERIFY WRISTBAND */}
      {verifyModalOpen && (
        <Modal
          title={t("Scan & Verify Newborn / Mother Wristband", "نوزائیدہ / والدہ کا کلائی بینڈ اسکین و تصدیق")}
          onClose={() => setVerifyModalOpen(false)}
        >
          <div className="space-y-4 text-xs">
            <form onSubmit={handleScanVerify} className="space-y-3">
              <Field label={t("Scan Wristband Barcode or Enter MRN Code", "کلائی بینڈ بارکوڈ اسکین کریں یا ایم آر این درج کریں")}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={scanCode}
                    onChange={(e) => setScanCode(e.target.value)}
                    placeholder="Scan HMS:PT:MRN-XXXXX or type barcode..."
                    className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 font-mono text-xs"
                    autoFocus
                    data-help="newborn_registration.scan_barcode_input"
                  />
                  <button
                    type="submit"
                    disabled={scanLoading || !scanCode.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-bold disabled:opacity-50"
                    data-help="newborn_registration.scan_verify_btn"
                  >
                    {scanLoading ? t("Verifying...", "تصدیق جاری...") : t("Verify Match", "تصدیق کریں")}
                  </button>
                </div>
              </Field>
            </form>

            {scanError && <ErrorBox error={scanError} />}

            {verifyResult && (
              <div className={`p-4 rounded-lg border-2 ${
                verifyResult.match
                  ? "bg-green-50 dark:bg-green-950/40 border-green-500 text-green-900 dark:text-green-200"
                  : "bg-red-50 dark:bg-red-950/40 border-red-500 text-red-900 dark:text-red-200"
              }`}>
                <div className="flex items-center gap-2 font-bold text-sm mb-2">
                  <span>{verifyResult.match ? "✅" : "⚠️"}</span>
                  <span>{verifyResult.match ? t("Identity Verified - Correct Patient Match!", "شناخت درست ہے - مریض کا صحیح میچ!") : t("Discrepancy Detected - Scanned Patient Does Not Match!", "شناخت میں فرق - اسکین شدہ مریض مماثل نہیں ہے!")}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="font-semibold">{t("Expected Patient:", "مطلوبہ مریض:")}</span>
                    <div>{verifyResult.expected_patient.full_name} ({verifyResult.expected_patient.mrn})</div>
                  </div>
                  <div>
                    <span className="font-semibold">{t("Scanned Patient on Band:", "اسکین شدہ بینڈ کا مریض:")}</span>
                    <div>{verifyResult.scanned_patient ? `${verifyResult.scanned_patient.full_name} (${verifyResult.scanned_patient.mrn})` : "Unregistered / Unknown MRN"}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setVerifyModalOpen(false)}
                className="px-4 py-1.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50"
                data-help="newborn_registration.btn_close_verify"
              >
                {t("Close", "بند کریں")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
