import React, { useEffect, useState } from "react";
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
  DonationOut,
  DonationCollectionIn,
  PrintOut_BloodDonationLabelFieldsOut_,
} from "../generated/blood_collection";
import {
  listDonations,
  donationLabels,
} from "../generated/blood_collection";
import {
  getBloodCollectionScreenView,
  isBloodCenterActive,
  getMaxAllowableVolumeMl,
  isAssessmentExpired,
  sortDonationsOldestFirst,
  validateCollectionInput,
  BAG_TYPES,
  COMMON_ANTICOAGULANTS,
  COMMON_UNSUCCESSFUL_REASONS,
  DONOR_REACTIONS,
  REACTION_HARMS,
} from "../blood-collection-policy";
import { useClinicalWrite, ClinicalWriteFeedback } from "../clinical-write";

export function BloodCollection({
  user,
  establishment,
  connected,
  stream,
}: {
  user: ClinicalUser & { roles?: string[]; registration?: string | null; designation?: string | null };
  establishment: EstablishmentOut;
  connected: boolean;
  stream: string;
}) {
  const view = getBloodCollectionScreenView(establishment);
  const activeBloodCenter = isBloodCenterActive(establishment);
  const canView = user.permissions?.includes("blood_center.view") ?? false;
  const canCollect = user.permissions?.includes("blood_center.collect") ?? false;
  const canProcess = user.permissions?.includes("blood_center.process") ?? false;
  const canPrintLabels = canCollect || canProcess;
  const canStartNew = view === "full" && canCollect && activeBloodCenter;

  const [activeTab, setActiveTab] = useState<"waiting" | "history">("waiting");
  const [revision, setRevision] = useState(0);

  // Label printing state (rule:653f9e21c7)
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [loadingLabels, setLoadingLabels] = useState(false);
  const [labelData, setLabelData] = useState<PrintOut_BloodDonationLabelFieldsOut_ | null>(null);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [selectedDonationForLabels, setSelectedDonationForLabels] = useState<DonationOut | null>(null);
  const [labelPrintedNotice, setLabelPrintedNotice] = useState<string | null>(null);

  // Collection modal / form state (rule:368f4aace1)
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState<DonationOut | null>(null);
  const [outcome, setOutcome] = useState<"Collected" | "Unsuccessful">("Collected");
  const [bagType, setBagType] = useState<"Single" | "Double" | "Triple" | "Quadruple">("Triple");
  const [bagLot, setBagLot] = useState<string>("");
  const [anticoagulant, setAnticoagulant] = useState<string>("CPDA-1");
  const [startedAt, setStartedAt] = useState<string>("");
  const [endedAt, setEndedAt] = useState<string>("");
  const [volumeMl, setVolumeMl] = useState<string>("450");
  const [unsuccessfulReason, setUnsuccessfulReason] = useState<string>("");
  const [donorReaction, setDonorReaction] = useState<
    "None" | "Vasovagal" | "Haematoma" | "Convulsions" | "Vomiting" | "Tetany" | "LocalAllergic" | "Severe" | "Other"
  >("None");
  const [reactionAction, setReactionAction] = useState<string>("");
  const [reactionHarm, setReactionHarm] = useState<"NoHarm" | "Mild" | "Moderate" | "Severe" | "Death">("NoHarm");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverErrorCode, setServerErrorCode] = useState<string | null>(null);
  const [recentIncidentNumber, setRecentIncidentNumber] = useState<string | null>(null);

  // History tab filters
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"Collected" | "Unsuccessful" | "All">("All");

  // Clinical write controller (rule:368f4aace1)
  const write = useClinicalWrite(user, "blood_collection", (value) => {
    setRevision((r) => r + 1);
    if (value?.reaction_incident_number) {
      setRecentIncidentNumber(value.reaction_incident_number);
    }
    if (value?.donor_reaction !== "Severe") {
      setCollectModalOpen(false);
      setSelectedDonation(null);
    }
  });

  // Load accepted donations waiting for phlebotomy (rule:6282d69357)
  const waitingState = useLoad(
    async () => {
      if (!canView) return [];
      const data = await listDonations({ status: "Accepted", limit: 100 });
      return sortDonationsOldestFirst(data);
    },
    [revision, canView]
  );

  // Load history donations
  const historyState = useLoad(
    async () => {
      if (!canView || activeTab !== "history") return [];
      if (historyStatusFilter === "All") {
        const [c, u] = await Promise.all([
          listDonations({ status: "Collected", limit: 50 }),
          listDonations({ status: "Unsuccessful", limit: 50 }),
        ]);
        return [...c, ...u].sort((a, b) => new Date(b.status_at).getTime() - new Date(a.status_at).getTime());
      }
      return await listDonations({ status: historyStatusFilter, limit: 100 });
    },
    [revision, canView, activeTab, historyStatusFilter]
  );

  // Real-time Event Subscription (establishment.changed)
  useEffect(() => {
    const handleEvent = (event: Event) => {
      const custom = event as CustomEvent;
      const data = custom.detail;
      if (!data) return;
      const evType = data.event_type || data.type;
      if (evType === "establishment.changed" || evType?.startsWith?.("blood_center.")) {
        setRevision((r) => r + 1);
      }
    };

    window.addEventListener("haspataal:event", handleEvent);
    return () => window.removeEventListener("haspataal:event", handleEvent);
  }, []);

  // Open label modal and fetch label payload
  const handleOpenLabels = async (donation: DonationOut) => {
    setSelectedDonationForLabels(donation);
    setLabelModalOpen(true);
    setLoadingLabels(true);
    setLabelError(null);
    setLabelPrintedNotice(null);
    try {
      const resp = await donationLabels(donation.donation_id);
      setLabelData(resp);
    } catch (err: any) {
      setLabelError(err?.message || "Failed to load donation labels from server.");
    } finally {
      setLoadingLabels(false);
    }
  };

  // Open collection modal
  const handleOpenCollection = (donation: DonationOut) => {
    setSelectedDonation(donation);
    setOutcome("Collected");
    setBagType("Triple");
    setBagLot("");
    setAnticoagulant("CPDA-1");
    const now = new Date();
    const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000);
    setStartedAt(tenMinsAgo.toISOString().slice(0, 16));
    setEndedAt(now.toISOString().slice(0, 16));
    const maxV = getMaxAllowableVolumeMl(donation.weight_kg);
    setVolumeMl(Math.min(450, maxV).toString());
    setUnsuccessfulReason("");
    setDonorReaction("None");
    setReactionAction("");
    setReactionHarm("NoHarm");
    setValidationErrors({});
    setServerError(null);
    setServerErrorCode(null);
    setRecentIncidentNumber(null);
    setCollectModalOpen(true);
  };

  // Submit collection record
  const handleSubmitCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDonation) return;

    const payload: DonationCollectionIn = {
      outcome,
      bag_type: outcome === "Collected" ? bagType : null,
      bag_lot: outcome === "Collected" ? bagLot.trim() : null,
      anticoagulant: outcome === "Collected" ? anticoagulant.trim() : null,
      started_at: outcome === "Collected" && startedAt ? new Date(startedAt).toISOString() : null,
      ended_at: outcome === "Collected" && endedAt ? new Date(endedAt).toISOString() : null,
      volume_ml: outcome === "Collected" ? parseInt(volumeMl, 10) : null,
      unsuccessful_reason: outcome === "Unsuccessful" ? unsuccessfulReason.trim() : null,
      donor_reaction: donorReaction,
      reaction_action: donorReaction !== "None" ? reactionAction.trim() : null,
      reaction_harm: donorReaction === "Severe" ? reactionHarm : null,
    };

    const val = validateCollectionInput(payload, selectedDonation);
    if (!val.valid) {
      setValidationErrors(val.errors as Record<string, string>);
      return;
    }
    setValidationErrors({});
    setServerError(null);
    setServerErrorCode(null);

    write.start({
      method: "POST",
      path: `/blood-center/donations/${selectedDonation.donation_id}/collection`,
      body: payload as any,
      permission: "blood_center.collect",
      protection: "reconcile",
      label: outcome === "Collected" ? "Record blood collection" : "Record unsuccessful bleed",
    });
  };

  // Catch write errors
  useEffect(() => {
    if (write.error) {
      const err = write.error as any;
      setServerError(err.message || String(write.error));
      if (err.code) {
        setServerErrorCode(err.code);
      }
    }
  }, [write.error]);

  // Quick action: switch to unsuccessful on 409 expired
  const handleSwitchToUnsuccessfulExpired = () => {
    setOutcome("Unsuccessful");
    setUnsuccessfulReason("Assessment Expired (> 24 hours elapsed since medical assessment).");
    setServerError(null);
    setServerErrorCode(null);
  };

  const donationsWaiting = waitingState.data || [];
  const donationsHistory = historyState.data || [];

  return (
    <div className="space-y-4 p-4 text-slate-800" data-help="blood_collection.container">
      {/* Header & Service View Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900" data-help="blood_collection.heading">
              {t("Blood Collection & Donor Adverse Reactions", "خون کا حصول اور عطیہ دہندہ کے ردعمل")}
            </h1>
            <span
              className="rounded bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800"
              data-help="blood_collection.service_badge"
            >
              PBTA Blood Center
            </span>
          </div>
          <p className="text-xs text-slate-500" data-help="blood_collection.subheading">
            {t(
              "Accepted donor waiting worklist, bedside label generation, phlebotomy logging & adverse event incident reporting",
              "منظور شدہ عطیہ دہندگان کی ورک لسٹ، بیڈ سائیڈ لیبلز، خون کے حصول کا اندراج اور منفی اثرات کی رپورٹنگ"
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRevision((r) => r + 1)}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            data-help="blood_collection.refresh"
          >
            {t("Refresh Worklist", "ورک لسٹ تازہ کریں")}
          </button>
        </div>
      </div>

      {/* Capability / View banners (rule:28291a1e73) */}
      {!activeBloodCenter && (
        <div
          className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
          data-help="blood_collection.service_inactive_banner"
        >
          <strong>{t("Notice: ", "توجہ: ")}</strong>
          {t(
            "The Blood Center service is not active for this establishment. Collection operations are locked.",
            "اس ادارے کے لیے بلڈ سینٹر کی سروس فعال نہیں ہے۔ خون جمع کرنے کا عمل بند ہے۔"
          )}
        </div>
      )}

      {view === "open_work" && (
        <div
          className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
          data-help="blood_collection.retiring_banner"
        >
          <strong>{t("Notice: ", "توجہ: ")}</strong>
          {t(
            "No new blood collections from now on (Blood Center service is Retiring). Existing accepted donations may still be completed.",
            "اب سے خون کا کوئی نیا حصول شروع نہیں ہوگا (بلڈ سینٹر سروس ریٹائر ہو رہی ہے)۔ پہلے سے موجود عطیات مکمل کیے جا سکتے ہیں۔"
          )}
        </div>
      )}

      {view === "records" && (
        <div
          className="rounded border border-sky-300 bg-sky-50 p-3 text-xs text-sky-900"
          data-help="blood_collection.records_banner"
        >
          <span className="font-semibold">{t("Records Only: ", "صرف ریکارڈز: ")}</span>
          {t(
            "The Blood Center service is retired. Historical collections, labels, and reaction reports are available in read-only mode.",
            "بلڈ سینٹر سروس بند ہو چکی ہے۔ ماضی کے ریکارڈز اور لیبلز صرف مطالعے کے لیے دستیاب ہیں۔"
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200" data-help="blood_collection.tabs">
        <button
          type="button"
          onClick={() => setActiveTab("waiting")}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            activeTab === "waiting"
              ? "border-rose-600 text-rose-700"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
          }`}
          data-help="blood_collection.tab_waiting"
        >
          {t("Waiting for Phlebotomy", "خون کے حصول کے منتظر عطیہ دہندگان")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            activeTab === "history"
              ? "border-rose-600 text-rose-700"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
          }`}
          data-help="blood_collection.tab_history"
        >
          {t("Collection History & Log", "حصول کی تاریخ اور لاگ")}
        </button>
      </div>

      {/* TAB 1: WAITING DONORS WORKLIST (rule:6282d69357) */}
      {activeTab === "waiting" && (
        <div className="space-y-3" data-help="blood_collection.waiting_section">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span data-help="blood_collection.worklist_note">
              {t(
                "Worklist ordered by waiting time (oldest assessment first). Label printing must be completed bedside before venepuncture.",
                "ورک لسٹ انتظار کے وقت کی ترتیب سے ہے (پرانی اسیسمنٹ سب سے پہلے)۔ سوئی لگانے سے پہلے لیبل پرنٹ کرنا لازمی ہے۔"
              )}
            </span>
          </div>

          <LoadState
            loading={waitingState.loading}
            error={waitingState.error}
            retry={waitingState.reload}
          />

          {!waitingState.loading && !waitingState.error && donationsWaiting.length === 0 && (
            <div data-help="blood_collection.empty_waiting">
              <Empty>
                <span className="font-semibold block">{t("No Accepted Donors Waiting", "خون دینے کے لیے کوئی منظور شدہ عطیہ دہندہ منتظر نہیں")}</span>
                <span className="text-xs text-slate-500 block mt-1">
                  {t(
                    "Donors cleared by medical assessment will appear here ready for phlebotomy and bedside label printing.",
                    "طبی معائنے سے منظور شدہ عطیہ دہندگان یہاں خون کے حصول کے لیے ظاہر ہوں گے۔"
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setRevision((r) => r + 1)}
                  className="mt-2 text-xs text-rose-600 underline"
                  data-help="blood_collection.btn_empty_refresh"
                >
                  {t("Refresh", "تازہ کریں")}
                </button>
              </Empty>
            </div>
          )}

          {!waitingState.loading && !waitingState.error && donationsWaiting.length > 0 && (
            <div className="overflow-x-auto rounded border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs text-slate-700" data-help="blood_collection.table_waiting">
                <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-800">
                  <tr>
                    <th className="p-2.5">{t("Donation #", "عطیہ نمبر")}</th>
                    <th className="p-2.5">{t("Donor # / Demographics", "عطیہ دہندہ نمبر و کوائف")}</th>
                    <th className="p-2.5">{t("Attended / Waiting", "حاضری / انتظار")}</th>
                    <th className="p-2.5">{t("Vitals & Eligibility", "معائنہ و موزونیت")}</th>
                    <th className="p-2.5">{t("Max Volume Limit", "زیادہ سے زیادہ مقدار")}</th>
                    <th className="p-2.5">{t("Assessed By", "معائنہ کنندہ ڈاکٹر")}</th>
                    <th className="p-2.5 text-right">{t("Actions", "اقدامات")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {donationsWaiting.map((don) => {
                    const expired = isAssessmentExpired(don.attended_at);
                    const maxVol = getMaxAllowableVolumeMl(don.weight_kg);
                    const elapsedMins = don.attended_at
                      ? Math.floor((Date.now() - new Date(don.attended_at).getTime()) / (60 * 1000))
                      : null;

                    return (
                      <tr
                        key={don.donation_id}
                        className={`hover:bg-slate-50 ${expired ? "bg-amber-50/50" : ""}`}
                        data-help="blood_collection.row_donation"
                      >
                        <td className="p-2.5 font-mono font-medium text-slate-900">
                          <div>{don.donation_number}</div>
                          <span className="text-[10px] text-slate-500">ID: {don.donation_id}</span>
                        </td>
                        <td className="p-2.5">
                          <div className="font-semibold text-slate-900">{don.donor_number}</div>
                          <div className="text-[11px] text-slate-500">
                            {don.donor_sex}, {don.age_years}y | {don.donation_kind}
                          </div>
                        </td>
                        <td className="p-2.5">
                          <div>{new Date(don.attended_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                          <div className="text-[11px]">
                            {elapsedMins !== null && (
                              <span className={expired ? "font-semibold text-red-600" : "text-slate-500"}>
                                {expired
                                  ? t("EXPIRED (>24h)", "معیاد ختم (>24 گھنٹے)")
                                  : `${elapsedMins} ${t("mins waiting", "منٹ سے منتظر")}`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5">
                          <div>
                            {don.weight_kg} kg | Hb {don.hb_g_dl} g/dL
                          </div>
                          <div className="text-[10px] text-slate-500">
                            BP {don.bp_systolic}/{don.bp_diastolic} | Pulse {don.pulse}
                          </div>
                        </td>
                        <td className="p-2.5">
                          <span className="inline-block rounded bg-sky-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-sky-800">
                            {maxVol} mL
                          </span>
                          {don.weight_kg < 50 && (
                            <div className="text-[10px] text-amber-700">
                              {t("Donor < 50 kg (9mL/kg + 10%)", "وزن 50 کلو سے کم")}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5">
                          <div className="text-[11px] font-medium text-slate-800">{don.assessed_stamp?.name || `Staff #${don.assessed_by}`}</div>
                          <div className="text-[10px] text-slate-500">{don.assessed_stamp?.registration || "PMDC verified"}</div>
                        </td>
                        <td className="p-2.5 text-right space-x-2">
                          {/* Print Bedside Labels Button (rule:653f9e21c7) */}
                          <button
                            type="button"
                            onClick={() => handleOpenLabels(don)}
                            disabled={!canPrintLabels}
                            className="rounded border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                            data-help="blood_collection.btn_print_labels"
                          >
                            {t("Print Labels", "لیبلز پرنٹ کریں")}
                          </button>

                          {/* Start Collection / Phlebotomy Button */}
                          {canStartNew && (
                            <button
                              type="button"
                              onClick={() => handleOpenCollection(don)}
                              className={`rounded px-2.5 py-1 text-xs font-semibold text-white shadow-sm ${
                                expired
                                  ? "bg-amber-600 hover:bg-amber-700"
                                  : "bg-rose-600 hover:bg-rose-700"
                              }`}
                              data-help="blood_collection.btn_record_collection"
                            >
                              {expired
                                ? t("Handle Expired", "معیاد ختم حل کریں")
                                : t("Record Bleed", "خون کا اندراج")}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COLLECTION HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-3" data-help="blood_collection.history_section">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 p-2.5">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <span>{t("Filter Outcome:", "نتیجہ فلٹر کریں:")}</span>
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value as any)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                data-help="blood_collection.filter_history_status"
              >
                <option value="All">{t("All Records", "تمام ریکارڈز")}</option>
                <option value="Collected">{t("Collected Only", "صرف مکمل شدہ")}</option>
                <option value="Unsuccessful">{t("Unsuccessful Only", "صرف نامکمل / ناکام")}</option>
              </select>
            </div>
            <span className="text-xs text-slate-500">
              {t("Displays phlebotomist signatures and reaction audit trail", "حصول کنندہ کے دستخط اور ردعمل کا آڈٹ ٹریل")}
            </span>
          </div>

          <LoadState
            loading={historyState.loading}
            error={historyState.error}
            retry={historyState.reload}
          />

          {!historyState.loading && !historyState.error && donationsHistory.length === 0 && (
            <div data-help="blood_collection.empty_history">
              <Empty>
                <span className="font-semibold block">{t("No Collection Records", "خون کے حصول کا کوئی ریکارڈ نہیں")}</span>
                <span className="text-xs text-slate-500 block mt-1">
                  {t("Completed or unsuccessful donation bleeds will be listed here.", "مکمل شدہ یا منسوخ شدہ خون کے عطیات یہاں درج ہوں گے۔")}
                </span>
                <button
                  type="button"
                  onClick={() => setRevision((r) => r + 1)}
                  className="mt-2 text-xs text-rose-600 underline"
                  data-help="blood_collection.btn_history_refresh"
                >
                  {t("Refresh", "تازہ کریں")}
                </button>
              </Empty>
            </div>
          )}

          {!historyState.loading && !historyState.error && donationsHistory.length > 0 && (
            <div className="overflow-x-auto rounded border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs text-slate-700" data-help="blood_collection.table_history">
                <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-800">
                  <tr>
                    <th className="p-2.5">{t("Donation #", "عطیہ نمبر")}</th>
                    <th className="p-2.5">{t("Donor #", "عطیہ دہندہ نمبر")}</th>
                    <th className="p-2.5">{t("Outcome", "نتیجہ")}</th>
                    <th className="p-2.5">{t("Pack & Volume", "بیگ و مقدار")}</th>
                    <th className="p-2.5">{t("Times & Duration", "اوقات و دورانیہ")}</th>
                    <th className="p-2.5">{t("Reaction & Incident", "ردعمل و رپورٹ")}</th>
                    <th className="p-2.5">{t("Collected By (Stamp)", "حصول کنندہ اسٹامپ")}</th>
                    <th className="p-2.5 text-right">{t("Labels", "لیبلز")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {donationsHistory.map((don) => (
                    <tr key={don.donation_id} className="hover:bg-slate-50" data-help="blood_collection.row_history">
                      <td className="p-2.5 font-mono font-medium text-slate-900">
                        {don.donation_number}
                      </td>
                      <td className="p-2.5 font-mono text-slate-700">
                        {don.donor_number}
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                            don.status === "Collected"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {don.status}
                        </span>
                      </td>
                      <td className="p-2.5">
                        {don.status === "Collected" ? (
                          <div>
                            <span className="font-semibold text-slate-800">{don.volume_ml} mL</span>
                            <div className="text-[10px] text-slate-500">
                              {don.bag_type} ({don.anticoagulant}) | Lot: {don.bag_lot}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-rose-700 italic">
                            {don.unsuccessful_reason || "Unsuccessful bleed"}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 text-[11px] text-slate-600">
                        {don.collection_started_at && don.collection_ended_at ? (
                          <div>
                            <div>
                              {new Date(don.collection_started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                              {new Date(don.collection_ended_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {Math.round(
                                (new Date(don.collection_ended_at).getTime() - new Date(don.collection_started_at).getTime()) /
                                  (60 * 1000)
                              )}{" "}
                              mins
                            </div>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="p-2.5">
                        {don.donor_reaction && don.donor_reaction !== "None" ? (
                          <div>
                            <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                              {don.donor_reaction}
                            </span>
                            {don.reaction_incident_number && (
                              <div className="mt-0.5 text-[10px] font-semibold text-rose-700">
                                Incident: {don.reaction_incident_number}
                              </div>
                            )}
                            {don.reaction_action && (
                              <div className="text-[10px] text-slate-500 truncate max-w-xs">
                                {don.reaction_action}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">None</span>
                        )}
                      </td>
                      <td className="p-2.5 text-[11px]">
                        {don.collected_stamp ? (
                          <div>
                            <div className="font-semibold text-slate-800">{don.collected_stamp.name}</div>
                            <div className="text-[10px] text-slate-500">{don.collected_stamp.text}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenLabels(don)}
                          className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700 hover:bg-slate-50"
                          data-help="blood_collection.btn_history_labels"
                        >
                          {t("View Labels", "لیبلز دیکھیں")}
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

      {/* MODAL 1: BEDSIDE LABELS PRINT MODAL (rule:653f9e21c7) */}
      {labelModalOpen && selectedDonationForLabels && (
        <Modal
          title={t("Bedside Donation Number Labels", "بیڈ سائیڈ خون کے عطیہ کے لیبلز")}
          onClose={() => setLabelModalOpen(false)}
        >
          <div className="space-y-4 text-xs text-slate-700" data-help="blood_collection.modal_labels">
            {/* Regulatory standard note */}
            <div className="rounded border border-blue-200 bg-blue-50 p-2.5 text-blue-900">
              <p className="font-semibold">
                {t("PBTA Standards Ch.2 S.5.2.1 / PBTA Act s.18(b)(x):", "پنجاب بلڈ ٹرانسفیوژن اتھارٹی کا معیار:")}
              </p>
              <p className="mt-1">
                {t(
                  "Print bar-coded donation number labels at the donor's side BEFORE venepuncture. Affix one label per bag of the pack (primary and satellites) and one label to each sample tube (red-top and EDTA). To maintain donor confidentiality and blinding, donor names are NEVER printed on blood bags.",
                  "خون نکالنے سے پہلے عطیہ دہندہ کے پاس بارکوڈ لیبل پرنٹ کریں۔ ایک لیبل ہر بیگ پر اور ایک ایک لیبل دونوں ٹیوبز پر لگائیں۔ رازداری کی خاطر بیگ پر عطیہ دہندہ کا نام نہیں لکھا جاتا۔"
                )}
              </p>
            </div>

            {loadingLabels && (
              <div className="py-6 text-center text-slate-500">
                {t("Loading label payload from server...", "سرور سے لیبل لوڈ ہو رہے ہیں...")}
              </div>
            )}

            {labelError && <ErrorBox error={labelError} />}

            {labelData && (
              <div className="space-y-3">
                <div className="rounded border border-slate-300 bg-slate-50 p-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500">Document Type</span>
                      <div className="font-semibold text-slate-900">{labelData.document_type}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Printer Role</span>
                      <div className="font-semibold text-indigo-700">{labelData.printer_role} ({labelData.paper_width_mm}mm)</div>
                    </div>
                  </div>

                  {/* Label Fields breakdown */}
                  <div className="grid grid-cols-2 gap-2 py-2 text-xs">
                    <div>
                      <span className="text-slate-500">Donation Number:</span>{" "}
                      <strong className="font-mono text-slate-900">{labelData.fields.donation_number}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Donor Number:</span>{" "}
                      <strong className="font-mono text-slate-900">{labelData.fields.donor_number}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Bag Labels Count:</span>{" "}
                      <strong>{labelData.fields.bag_labels} bag label(s)</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Tube Labels Count:</span>{" "}
                      <strong>{labelData.fields.tube_labels} tube labels (Red + EDTA)</strong>
                    </div>
                  </div>

                  {/* Barcode representation */}
                  {labelData.barcode_svg && (
                    <div className="mt-2 rounded bg-white p-2 border border-slate-200 flex flex-col items-center justify-center">
                      <div
                        dangerouslySetInnerHTML={{ __html: labelData.barcode_svg }}
                        className="max-h-20 overflow-hidden"
                      />
                      <span className="mt-1 font-mono text-[11px] font-bold text-slate-800">
                        {labelData.fields.donation_number}
                      </span>
                    </div>
                  )}

                  {/* ESC/POS Raw text format */}
                  {labelData.text && (
                    <div className="mt-3">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Receipt Text (ESC/POS 48-col)</span>
                      <pre className="mt-1 overflow-x-auto rounded bg-slate-900 p-2 font-mono text-[11px] text-green-400">
                        {labelData.text}
                      </pre>
                    </div>
                  )}
                </div>

                {labelPrintedNotice && (
                  <div className="rounded border border-emerald-300 bg-emerald-50 p-2 text-emerald-900">
                    {labelPrintedNotice}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLabelPrintedNotice(
                        t(
                          "Labels sent to terminal label printer. Ready for bedside verification.",
                          "لیبلز ٹرمینل پرنٹر کو بھیج دیے گئے۔"
                        )
                      );
                    }}
                    className="rounded bg-indigo-600 px-3 py-1.5 font-semibold text-white hover:bg-indigo-700"
                    data-help="blood_collection.btn_send_printer"
                  >
                    {t("Send to Label Printer", "لیبل پرنٹر پر بھیجیں")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLabelModalOpen(false)}
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                    data-help="blood_collection.btn_close_labels"
                  >
                    {t("Close", "بند کریں")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* MODAL 2: RECORD COLLECTION MODAL (rule:368f4aace1, rule:834ffec14a, rule:8c56f5bd5c) */}
      {collectModalOpen && selectedDonation && (
        <Modal
          title={t("Record Blood Collection", "خون کے حصول کا اندراج")}
          onClose={() => setCollectModalOpen(false)}
        >
          <form onSubmit={handleSubmitCollection} className="space-y-4 text-xs text-slate-800" data-help="blood_collection.modal_collect">
            {/* Feedback / double submit write */}
            <ClinicalWriteFeedback write={write} />

            {/* Donation Summary Header */}
            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono font-bold text-slate-900">{selectedDonation.donation_number}</span>
                  <span className="ml-2 text-slate-500">Donor: {selectedDonation.donor_number}</span>
                </div>
                <div className="text-right text-slate-600">
                  <span>Weight: <strong>{selectedDonation.weight_kg} kg</strong></span> |{" "}
                  <span>Hb: <strong>{selectedDonation.hb_g_dl} g/dL</strong></span>
                </div>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  Max Volume Limit:{" "}
                  <strong className="text-rose-700 font-mono">
                    {getMaxAllowableVolumeMl(selectedDonation.weight_kg)} mL
                  </strong>
                </span>
                <span>
                  Attended: {new Date(selectedDonation.attended_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>

            {/* Server Error Callout */}
            {serverError && (
              <div className="rounded border border-rose-300 bg-rose-50 p-3 text-rose-900">
                <div className="font-semibold">{serverError}</div>
                {/* Expired Assessment 409 recovery path (rule:834ffec14a) */}
                {serverErrorCode === "BLOOD_ASSESSMENT_EXPIRED" && (
                  <div className="mt-2 text-xs">
                    <p className="text-rose-800">
                      {t(
                        "The donor's assessment is more than 24 hours old. PBTA standards require recording this unit Unsuccessful and re-assessing the donor.",
                        "عطیہ دہندہ کی اسیسمنٹ 24 گھنٹے سے پرانی ہے۔ پی بی ٹی اے کے مطابق اسے نامکمل درج کریں اور دوبارہ اسیسمنٹ کروائیں۔"
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={handleSwitchToUnsuccessfulExpired}
                      className="mt-2 rounded bg-rose-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-800"
                      data-help="blood_collection.btn_switch_unsuccessful_expired"
                    >
                      {t("Switch to 'Unsuccessful' & Save Reason", "نامکمل پر تبدیل کریں اور محفوظ کریں")}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Success Incident Notice */}
            {recentIncidentNumber && (
              <div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">
                <div className="font-bold">
                  {t("Section 13 Incident Report Logged:", "سیکشن 13 واقعہ رپورٹ درج کر دی گئی:")}
                </div>
                <div className="mt-1 font-mono text-sm font-semibold text-rose-800">
                  {recentIncidentNumber}
                </div>
                <p className="mt-1 text-[11px]">
                  {t(
                    "The severe adverse reaction was immediately registered in the hospital incident registry and submitted for regulatory review.",
                    "شدید ردعمل ہسپتال کے انسیدنٹ رجسٹر میں درج کر لیا گیا ہے۔"
                  )}
                </p>
              </div>
            )}

            {/* Outcome Selection */}
            <Field label={t("Collection Outcome", "حصول کا نتیجہ")}>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="outcome"
                    value="Collected"
                    checked={outcome === "Collected"}
                    onChange={() => setOutcome("Collected")}
                    className="text-rose-600 focus:ring-rose-500"
                    data-help="blood_collection.radio_outcome_collected"
                  />
                  <span className="font-semibold text-emerald-800">{t("Collected (Successful)", "کامیاب حصول")}</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="outcome"
                    value="Unsuccessful"
                    checked={outcome === "Unsuccessful"}
                    onChange={() => setOutcome("Unsuccessful")}
                    className="text-rose-600 focus:ring-rose-500"
                    data-help="blood_collection.radio_outcome_unsuccessful"
                  />
                  <span className="font-semibold text-rose-800">{t("Unsuccessful Bleed", "ناکام / ادھورا حصول")}</span>
                </label>
              </div>
            </Field>

            {/* SECTION: COLLECTED FIELDS */}
            {outcome === "Collected" && (
              <div className="space-y-3 rounded border border-slate-200 bg-white p-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Bag Type */}
                  <Field
                    label={t("Blood Bag Pack Type", "بلڈ بیگ پیک قسم")}
                    hint={validationErrors.bag_type}
                  >
                    <select
                      value={bagType}
                      onChange={(e) => setBagType(e.target.value as any)}
                      className="w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-800"
                      data-help="blood_collection.select_bag_type"
                    >
                      {BAG_TYPES.map((b) => (
                        <option key={b.value} value={b.value}>
                          {b.labelEn}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {/* Bag Lot Barcode */}
                  <Field
                    label={t("Bag Lot Barcode / Serial #", "بیگ لاٹ بارکوڈ یا سیریل")}
                    hint={validationErrors.bag_lot}
                  >
                    <input
                      type="text"
                      value={bagLot}
                      onChange={(e) => setBagLot(e.target.value)}
                      placeholder="e.g. BAG-2610-07"
                      maxLength={60}
                      className="w-full rounded border border-slate-300 p-1.5 font-mono text-xs text-slate-800"
                      data-help="blood_collection.input_bag_lot"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Anticoagulant */}
                  <Field
                    label={t("Anticoagulant Solution", "اینٹی کوگولنٹ سلوشن")}
                    hint={validationErrors.anticoagulant}
                  >
                    <select
                      value={anticoagulant}
                      onChange={(e) => setAnticoagulant(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-800"
                      data-help="blood_collection.select_anticoagulant"
                    >
                      {COMMON_ANTICOAGULANTS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {/* Collected Volume */}
                  <Field
                    label={`${t("Volume Collected (mL)", "حاصل کردہ مقدار (ملی لیٹر)")} [Max: ${getMaxAllowableVolumeMl(
                      selectedDonation.weight_kg
                    )} mL]`}
                    hint={validationErrors.volume_ml}
                  >
                    <input
                      type="number"
                      min={1}
                      max={getMaxAllowableVolumeMl(selectedDonation.weight_kg)}
                      value={volumeMl}
                      onChange={(e) => setVolumeMl(e.target.value)}
                      className="w-full rounded border border-slate-300 p-1.5 font-mono text-xs text-slate-800"
                      data-help="blood_collection.input_volume_ml"
                    />
                  </Field>
                </div>

                {/* Timing */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field
                    label={t("Venepuncture Start Time", "شروع کا وقت")}
                    hint={validationErrors.started_at}
                  >
                    <input
                      type="datetime-local"
                      value={startedAt}
                      onChange={(e) => setStartedAt(e.target.value)}
                      className="w-full rounded border border-slate-300 p-1.5 text-xs text-slate-800"
                      data-help="blood_collection.input_started_at"
                    />
                  </Field>
                  <Field
                    label={t("Venepuncture End Time", "اختتام کا وقت")}
                    hint={validationErrors.ended_at}
                  >
                    <input
                      type="datetime-local"
                      value={endedAt}
                      onChange={(e) => setEndedAt(e.target.value)}
                      className="w-full rounded border border-slate-300 p-1.5 text-xs text-slate-800"
                      data-help="blood_collection.input_ended_at"
                    />
                  </Field>
                </div>
              </div>
            )}

            {/* SECTION: UNSUCCESSFUL REASON */}
            {outcome === "Unsuccessful" && (
              <div className="space-y-2 rounded border border-rose-200 bg-rose-50 p-3">
                <Field
                  label={t("Reason for Incomplete / Unsuccessful Bleed", "ناکام یا نامکمل ہونے کی وجہ")}
                  hint={validationErrors.unsuccessful_reason}
                >
                  <select
                    onChange={(e) => {
                      if (e.target.value) setUnsuccessfulReason(e.target.value);
                    }}
                    className="mb-1 w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-700"
                    data-help="blood_collection.select_common_unsuccessful"
                  >
                    <option value="">{t("-- Select common reason or type below --", "-- منتخب کریں یا نیچے درج کریں --")}</option>
                    {COMMON_UNSUCCESSFUL_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={unsuccessfulReason}
                    onChange={(e) => setUnsuccessfulReason(e.target.value)}
                    placeholder={t("Document reason for unsuccessful bleed...", "وجہ تحریر کریں...")}
                    className="w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-800"
                    data-help="blood_collection.textarea_unsuccessful_reason"
                  />
                </Field>
              </div>
            )}

            {/* SECTION: ADVERSE REACTION & SECTION 13 INCIDENT (rule:8c56f5bd5c) */}
            <div className="space-y-3 rounded border border-amber-200 bg-amber-50/60 p-3">
              <div className="font-semibold text-slate-900 flex items-center justify-between">
                <span>{t("Donor Adverse Reaction & Incident Reporting", "منفی ردعمل اور واقعہ کی رپورٹنگ")}</span>
                <span className="text-[10px] text-amber-800 font-normal">PBTA Standards S.5.4</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field
                  label={t("Donor Reaction Observed", "ردعمل کا مشاہدہ")}
                >
                  <select
                    value={donorReaction}
                    onChange={(e) => setDonorReaction(e.target.value as any)}
                    className="w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-800"
                    data-help="blood_collection.select_donor_reaction"
                  >
                    {DONOR_REACTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.labelEn}
                      </option>
                    ))}
                  </select>
                </Field>

                {donorReaction === "Severe" && (
                  <Field
                    label={t("Harm Severity Level", "نقصان کی شدت")}
                    hint={validationErrors.reaction_harm}
                  >
                    <select
                      value={reactionHarm}
                      onChange={(e) => setReactionHarm(e.target.value as any)}
                      className="w-full rounded border border-rose-300 bg-white p-1.5 text-xs font-semibold text-rose-800"
                      data-help="blood_collection.select_reaction_harm"
                    >
                      {REACTION_HARMS.map((h) => (
                        <option key={h.value} value={h.value}>
                          {h.labelEn}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>

              {donorReaction !== "None" && (
                <Field
                  label={t("Action Taken & Medical Care Rendered", "اقدامات اور طبی امداد")}
                  hint={validationErrors.reaction_action}
                >
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={reactionAction}
                    onChange={(e) => setReactionAction(e.target.value)}
                    placeholder={t(
                      "e.g. Donor laid recumbent with feet elevated, cold compresses applied, oral hydration offered, vital signs monitored until fully stable.",
                      "طبی اقدامات درج کریں..."
                    )}
                    className="w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-800"
                    data-help="blood_collection.textarea_reaction_action"
                  />
                </Field>
              )}

              {donorReaction === "Severe" && (
                <div
                  className="rounded border border-rose-300 bg-rose-50 p-2.5 text-rose-900"
                  data-help="blood_collection.severe_incident_notice"
                >
                  <strong>{t("Section 13 Mandatory Notification: ", "سیکشن 13 لازمی اطلاع: ")}</strong>
                  {t(
                    "Recording a Severe adverse reaction automatically triggers an Incident Report on the server, issuing an incident number for regulatory review by the Transfusion Authority.",
                    "شدید ردعمل پر سرور پر خودکار واقعہ رپورٹ درج ہوتی ہے جو اتھارٹی کو بھیجی جاتی ہے۔"
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCollectModalOpen(false)}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                data-help="blood_collection.btn_cancel_collect"
              >
                {t("Cancel", "منسوخ")}
              </button>
              <button
                type="submit"
                disabled={write.busy}
                className="rounded bg-rose-600 px-4 py-1.5 font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                data-help="blood_collection.btn_submit_collect"
              >
                {write.busy
                  ? t("Submitting...", "جمع ہو رہا ہے...")
                  : outcome === "Collected"
                  ? t("Complete Bleed Record", "خون کا حصول مکمل کریں")
                  : t("Save Incomplete Bleed", "نامکمل محفوظ کریں")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
