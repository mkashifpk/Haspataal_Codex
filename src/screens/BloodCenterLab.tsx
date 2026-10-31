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
  CenterComponentIn,
  CenterComponentOut,
  DonationDetailOut,
  DonationOut,
  DonationTestIn,
  PrintOut_BloodComponentLabelFieldsOut_,
} from "../generated/blood_center_lab";
import {
  listDonations,
  getDonation,
  recordTests,
  prepare,
  listComponents,
  discardBloodCenterComponents,
  componentLabel,
} from "../generated/blood_center_lab";
import {
  getBloodCenterLabScreenView,
  isBloodCenterActive,
  canRecordTests,
  canPrepareComponents,
  isProcessingTimeExceeded,
  calculateDefaultExpiry,
  MANDATORY_TTI_MARKERS,
  GROUPING_MARKERS,
  COMPONENT_DISCARD_REASONS,
  validateTestsInput,
} from "../blood-center-lab-policy";
import { useClinicalWrite, ClinicalWriteFeedback } from "../clinical-write";

export function BloodCenterLab({
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
  const view = getBloodCenterLabScreenView(establishment);
  const activeBloodCenter = isBloodCenterActive(establishment);
  const canView = user.permissions?.includes("blood_center.view") ?? false;
  const canProcess = user.permissions?.includes("blood_center.process") ?? false;
  const canRecordTestsAction = canRecordTests(establishment, canProcess);
  const canPrepareAction = canPrepareComponents(establishment, canProcess);

  const [activeTab, setActiveTab] = useState<"donations" | "quarantine">("donations");
  const [revision, setRevision] = useState(0);
  const [realtimeAlert, setRealtimeAlert] = useState<string | null>(null);

  // Quarantine sub-filter (rule:7e769d8e04)
  const [quarantineFilter, setQuarantineFilter] = useState<"All" | "Quarantine" | "Discarded" | "Released">("Quarantine");

  // Selected Donation for Inspection modal
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState<DonationDetailOut | null>(null);
  const [loadingInspection, setLoadingInspection] = useState(false);

  // Testing Modal State (rule:ac0462c02a, rule:7e769d8e04)
  const [testsModalOpen, setTestsModalOpen] = useState(false);
  const [targetDonationForTests, setTargetDonationForTests] = useState<DonationOut | null>(null);
  const [testRows, setTestRows] = useState<DonationTestIn[]>([]);
  const [testsError, setTestsError] = useState<string | null>(null);

  // Component Preparation Modal State (rule:22b4758a41, rule:6dab3d3a8e)
  const [componentsModalOpen, setComponentsModalOpen] = useState(false);
  const [targetDonationForPrep, setTargetDonationForPrep] = useState<DonationOut | null>(null);
  const [prepMode, setPrepMode] = useState<"WholeBlood" | "Separated">("Separated");
  const [wbVolume, setWbVolume] = useState<string>("450");
  const [wbExpiry, setWbExpiry] = useState<string>("");
  const [prbcVolume, setPrbcVolume] = useState<string>("250");
  const [prbcExpiry, setPrbcExpiry] = useState<string>("");
  const [ffpVolume, setFfpVolume] = useState<string>("200");
  const [ffpExpiry, setFfpExpiry] = useState<string>("");
  const [pltVolume, setPltVolume] = useState<string>("60");
  const [pltExpiry, setPltExpiry] = useState<string>("");
  const [includePlatelets, setIncludePlatelets] = useState<boolean>(true);
  const [prepError, setPrepError] = useState<string | null>(null);

  // Discard Modal State (rule:87598ad7aa)
  const [discardModalOpen, setDiscardModalOpen] = useState(false);
  const [targetComponentForDiscard, setTargetComponentForDiscard] = useState<CenterComponentOut | null>(null);
  const [discardReason, setDiscardReason] = useState<string>("ReactiveScreening");
  const [discardNote, setDiscardNote] = useState<string>("");
  const [discardError, setDiscardError] = useState<string | null>(null);

  // Component Label Modal State
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState(false);
  const [labelData, setLabelData] = useState<PrintOut_BloodComponentLabelFieldsOut_ | null>(null);
  const [labelError, setLabelError] = useState<string | null>(null);

  // Clinical write controller
  const write = useClinicalWrite(user, "blood_center_lab", (value, cmd) => {
    setRevision((r) => r + 1);
    if (cmd.path.includes("/tests")) {
      setTestsModalOpen(false);
      setTargetDonationForTests(null);
    } else if (cmd.path.includes("/components") && !cmd.path.includes("/discard")) {
      setComponentsModalOpen(false);
      setTargetDonationForPrep(null);
      setActiveTab("quarantine");
    } else if (cmd.path.includes("/discard")) {
      setDiscardModalOpen(false);
      setTargetComponentForDiscard(null);
    }
  });

  // Load collected donations worklist (rule:ac0462c02a)
  const donationsState = useLoad(
    async () => {
      if (!canView) return [];
      return await listDonations({ status: "Collected", limit: 100 });
    },
    [revision, canView]
  );

  // Load quarantine components inventory (rule:7e769d8e04)
  const componentsState = useLoad(
    async () => {
      if (!canView || activeTab !== "quarantine") return [];
      const queryStatus = quarantineFilter === "All" ? undefined : (quarantineFilter as any);
      return await listComponents({ status: queryStatus, limit: 100 });
    },
    [revision, canView, activeTab, quarantineFilter]
  );

  // Real-time Event Subscription (blood_center.donation.reactive)
  useEffect(() => {
    const handleEvent = (event: Event) => {
      const custom = event as CustomEvent;
      const data = custom.detail;
      if (!data) return;
      const evType = data.event_type || data.type;

      if (evType === "blood_center.donation.reactive") {
        setRealtimeAlert(
          t(
            "Reactive Screening Alert: A blood unit was flagged reactive during testing. Move components to quarantine immediately.",
            "رد عمل کا انتباہ: اسکریننگ ٹیسٹ میں خون کا یونٹ ری ایکٹیو پایا گیا۔ اجزاء کو فوری قرنطینہ میں منتقل کریں۔"
          )
        );
        setRevision((r) => r + 1);
      } else if (evType === "establishment.changed") {
        setRevision((r) => r + 1);
      }
    };

    window.addEventListener("haspataal:event", handleEvent);
    return () => window.removeEventListener("haspataal:event", handleEvent);
  }, []);

  // Inspect donation details
  const handleOpenInspect = async (donationId: number) => {
    setLoadingInspection(true);
    setInspectModalOpen(true);
    try {
      const data = await getDonation(donationId);
      setSelectedDonation(data);
    } catch (err: any) {
      alert(err?.message || "Failed to load donation details.");
      setInspectModalOpen(false);
    } finally {
      setLoadingInspection(false);
    }
  };

  // Open tests modal and initialize grid with empty results (rule:ac0462c02a)
  const handleOpenTests = (donation: DonationOut) => {
    setTargetDonationForTests(donation);
    setTestsError(null);
    // Initialize empty grid: 5 TTI screens + 2 runs each of ABOForward, ABOReverse, RhD
    const initialRows: DonationTestIn[] = [
      // 5 Mandatory TTI screens
      { marker: "HBsAg", sample: "Initial", method: "ELISA", kit_lot: "KIT-HBS-26", result: "" as any },
      { marker: "AntiHCV", sample: "Initial", method: "ELISA", kit_lot: "KIT-HCV-26", result: "" as any },
      { marker: "AntiHIV", sample: "Initial", method: "ELISA", kit_lot: "KIT-HIV-26", result: "" as any },
      { marker: "Syphilis", sample: "Initial", method: "Rapid", kit_lot: "KIT-SYP-26", result: "" as any },
      { marker: "Malaria", sample: "Initial", method: "Rapid", kit_lot: "KIT-MAL-26", result: "" as any },
      // Grouping Determinations - Dual Testing (rule:ac0462c02a)
      { marker: "ABOForward", sample: "Initial", method: "Tube", kit_lot: "ANTI-ABO-A1", result: "" as any },
      { marker: "ABOForward", sample: "Repeat", method: "Gel", kit_lot: "ANTI-ABO-A2", result: "" as any },
      { marker: "ABOReverse", sample: "Initial", method: "Tube", kit_lot: "REV-CELL-B1", result: "" as any },
      { marker: "ABOReverse", sample: "Repeat", method: "Gel", kit_lot: "REV-CELL-B2", result: "" as any },
      { marker: "RhD", sample: "Initial", method: "Tube", kit_lot: "ANTI-D-R1", result: "" as any },
      { marker: "RhD", sample: "Repeat", method: "Gel", kit_lot: "ANTI-D-R2", result: "" as any },
    ];
    setTestRows(initialRows);
    setTestsModalOpen(true);
  };

  // Add a repeat test row (rule:7e769d8e04: "Repeat on another sample from the bag")
  const handleAddRepeatTest = (marker: any) => {
    setTestRows((rows) => [
      ...rows,
      {
        marker,
        sample: "Repeat",
        method: "ELISA",
        kit_lot: "REPEAT-SAMPLE-BAG",
        result: "" as any,
      },
    ]);
  };

  // Submit recorded laboratory tests
  const handleSubmitTests = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDonationForTests) return;

    // Filter filled rows
    const filled = testRows.filter((r) => Boolean(r.result));
    const val = validateTestsInput(filled);
    if (!val.valid) {
      setTestsError(val.errors.join("\n• "));
      return;
    }
    setTestsError(null);

    write.start({
      method: "POST",
      path: `/blood-center/donations/${targetDonationForTests.donation_id}/tests`,
      body: { results: filled },
      permission: "blood_center.process",
      protection: "idempotent",
      label: `Record Laboratory Tests for Donation #${targetDonationForTests.donation_number}`,
    });
  };

  // Open Component Preparation Modal
  const handleOpenPrep = (donation: DonationOut) => {
    setTargetDonationForPrep(donation);
    setPrepError(null);
    setPrepMode(donation.bag_type === "Single" ? "WholeBlood" : "Separated");
    setWbVolume(donation.volume_ml ? donation.volume_ml.toString() : "450");
    setWbExpiry(calculateDefaultExpiry("WholeBlood", donation.collection_ended_at));
    setPrbcVolume("250");
    setPrbcExpiry(calculateDefaultExpiry("RedCells", donation.collection_ended_at));
    setFfpVolume("200");
    setFfpExpiry(calculateDefaultExpiry("FreshFrozenPlasma", donation.collection_ended_at));
    setPltVolume("60");
    setPltExpiry(calculateDefaultExpiry("Platelets", donation.collection_ended_at));
    setIncludePlatelets(donation.bag_type === "Triple" || donation.bag_type === "Quadruple");
    setComponentsModalOpen(true);
  };

  // Submit component preparation
  const handleSubmitPrep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDonationForPrep) return;

    const components: CenterComponentIn[] = [];
    if (prepMode === "WholeBlood") {
      components.push({
        component: "WholeBlood",
        volume_ml: parseInt(wbVolume, 10) || 450,
        expires_at: wbExpiry ? new Date(wbExpiry).toISOString() : null,
      });
    } else {
      // Red Cells
      components.push({
        component: "RedCells",
        volume_ml: parseInt(prbcVolume, 10) || 250,
        expires_at: prbcExpiry ? new Date(prbcExpiry).toISOString() : null,
      });
      // Fresh Frozen Plasma
      components.push({
        component: "FreshFrozenPlasma",
        volume_ml: parseInt(ffpVolume, 10) || 200,
        expires_at: ffpExpiry ? new Date(ffpExpiry).toISOString() : null,
      });
      // Platelets
      if (includePlatelets) {
        components.push({
          component: "Platelets",
          volume_ml: parseInt(pltVolume, 10) || 60,
          expires_at: pltExpiry ? new Date(pltExpiry).toISOString() : null,
        });
      }
    }

    write.start({
      method: "POST",
      path: `/blood-center/donations/${targetDonationForPrep.donation_id}/components`,
      body: { components },
      permission: "blood_center.process",
      protection: "idempotent",
      label: `Prepare Components for Donation #${targetDonationForPrep.donation_number}`,
    });
  };

  // Open Discard Modal (rule:87598ad7aa)
  const handleOpenDiscard = (comp: CenterComponentOut) => {
    setTargetComponentForDiscard(comp);
    setDiscardReason("ReactiveScreening");
    setDiscardNote("");
    setDiscardError(null);
    setDiscardModalOpen(true);
  };

  // Submit Discard
  const handleSubmitDiscard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetComponentForDiscard) return;
    if (discardReason === "Other" && !discardNote.trim()) {
      setDiscardError("A documented clinical note is required when reason is Other.");
      return;
    }
    setDiscardError(null);

    write.start({
      method: "POST",
      path: `/blood-center/components/${targetComponentForDiscard.component_id}/discard`,
      body: {
        reason: discardReason,
        note: discardNote.trim() || null,
      },
      permission: "blood_center.process",
      protection: "reconcile",
      label: `Discard Component #${targetComponentForDiscard.component_id}`,
    });
  };

  // Open Component Label
  const handleOpenComponentLabel = async (componentId: number) => {
    setLoadingLabel(true);
    setLabelModalOpen(true);
    setLabelError(null);
    try {
      const data = await componentLabel(componentId);
      setLabelData(data);
    } catch (err: any) {
      setLabelError(err?.message || "Failed to fetch component label.");
    } finally {
      setLoadingLabel(false);
    }
  };

  const collectedDonations = donationsState.data || [];
  const quarantineComponents = componentsState.data || [];

  return (
    <div className="space-y-4 p-4 text-slate-800" data-help="blood_center_lab.container">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900" data-help="blood_center_lab.heading">
              {t("Blood Center Laboratory", "بلڈ سنٹر لیبارٹری اور ٹیسٹنگ")}
            </h1>
            <span
              className="rounded bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800"
              data-help="blood_center_lab.service_badge"
            >
              PBTA Screening & Processing
            </span>
          </div>
          <p className="text-xs text-slate-500" data-help="blood_center_lab.subheading">
            {t(
              "Mandatory 5-marker TTI screening, ABO/Rh dual determinations, component separation into quarantine & discarding",
              "متعدی بیماریوں کی اسکریننگ، اے بی او و آر ایچ ٹیسٹ، قرنطینہ میں اجزاء کی تیاری اور تلفی"
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRevision((r) => r + 1)}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            data-help="blood_center_lab.refresh"
          >
            {t("Refresh Worklist", "ورک لسٹ تازہ کریں")}
          </button>
        </div>
      </div>

      {/* Real-time alert banner (ev:blood_center.donation.reactive) */}
      {realtimeAlert && (
        <div
          className="flex items-center justify-between rounded border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900"
          data-help="blood_center_lab.realtime_alert"
        >
          <div>
            <strong>{t("Alert: ", "انتباہ: ")}</strong>
            {realtimeAlert}
          </div>
          <button
            type="button"
            onClick={() => setRealtimeAlert(null)}
            className="font-bold text-rose-700 hover:text-rose-900"
            data-help="blood_center_lab.btn_dismiss_alert"
          >
            {t("Dismiss", "ہٹائیں")}
          </button>
        </div>
      )}

      {/* View Banners (rule:e9c40bc39d) */}
      {!activeBloodCenter && (
        <div
          className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
          data-help="blood_center_lab.service_inactive_banner"
        >
          <strong>{t("Notice: ", "توجہ: ")}</strong>
          {t("Blood Center service is inactive for this establishment.", "اس ادارے کے لیے بلڈ سنٹر کی سروس فعال نہیں ہے۔")}
        </div>
      )}

      {view === "open_work" && (
        <div
          className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
          data-help="blood_center_lab.retiring_banner"
        >
          <strong>{t("Notice: ", "توجہ: ")}</strong>
          {t(
            "No new donor collections from now on (Blood Center service is Retiring). Existing collected units and quarantine components may still be tested and processed.",
            "اب سے خون کا نیا حصول شروع نہیں ہوگا (بلڈ سنٹر سروس ریٹائر ہو رہی ہے)۔ جمع شدہ یونٹس کے ٹیسٹ اور پروسیسنگ جاری رکھی جا سکتی ہے۔"
          )}
        </div>
      )}

      {view === "records" && (
        <div
          className="rounded border border-sky-300 bg-sky-50 p-3 text-xs text-sky-900"
          data-help="blood_center_lab.records_banner"
        >
          <span className="font-semibold">{t("Records Only: ", "صرف ریکارڈز: ")}</span>
          {t(
            "Blood Center service is retired. Laboratory tests and quarantine logs are in read-only mode.",
            "بلڈ سنٹر سروس بند ہو چکی ہے۔ لیب ٹیسٹ اور قرنطینہ کا ریکارڈ صرف مطالعے کے لیے دستیاب ہے۔"
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200" data-help="blood_center_lab.tabs">
        <button
          type="button"
          onClick={() => setActiveTab("donations")}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            activeTab === "donations"
              ? "border-rose-600 text-rose-700"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
          }`}
          data-help="blood_center_lab.tab_donations"
        >
          {t("Collected Units Waiting for Testing", "ٹیسٹنگ کے منتظر یونٹس")} ({collectedDonations.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("quarantine")}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            activeTab === "quarantine"
              ? "border-rose-600 text-rose-700"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
          }`}
          data-help="blood_center_lab.tab_quarantine"
        >
          {t("Quarantine Inventory & Discards", "قرنطینہ اسٹاک و تلفی")}
        </button>
      </div>

      {/* TAB 1: COLLECTED DONATIONS WORKLIST (rule:ac0462c02a) */}
      {activeTab === "donations" && (
        <div className="space-y-3" data-help="blood_center_lab.donations_section">
          <div className="text-xs text-slate-600">
            {t(
              "Donations in Collected status awaiting 5-marker TTI screening (HBsAg, Anti-HCV, Anti-HIV, Syphilis, Malaria), dual ABO/Rh determinations, and component preparation.",
              "جمع شدہ خون کے بیگز جن کی 5 متعدی امراض کی اسکریننگ، اے بی او و آر ایچ کے دوہرے ٹیسٹ اور اجزاء کی تیاری باقی ہے۔"
            )}
          </div>

          <LoadState
            loading={donationsState.loading}
            error={donationsState.error}
            retry={donationsState.reload}
          />

          {!donationsState.loading && !donationsState.error && collectedDonations.length === 0 && (
            <div data-help="blood_center_lab.empty_donations">
              <Empty>
                <span className="font-semibold block">{t("No Collected Donations Waiting", "ٹیسٹنگ کے لیے کوئی یونٹ منتظر نہیں")}</span>
                <span className="text-xs text-slate-500 block mt-1">
                  {t("Collected blood units will appear here for laboratory testing and component separation.", "خون کے جمع شدہ یونٹس یہاں ٹیسٹنگ کے لیے ظاہر ہوں گے۔")}
                </span>
                <button
                  type="button"
                  onClick={() => setRevision((r) => r + 1)}
                  className="mt-2 text-xs text-rose-600 underline"
                  data-help="blood_center_lab.btn_empty_refresh"
                >
                  {t("Refresh", "تازہ کریں")}
                </button>
              </Empty>
            </div>
          )}

          {!donationsState.loading && !donationsState.error && collectedDonations.length > 0 && (
            <div className="overflow-x-auto rounded border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs text-slate-700" data-help="blood_center_lab.table_donations">
                <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-800">
                  <tr>
                    <th className="p-2.5">{t("Donation #", "عطیہ نمبر")}</th>
                    <th className="p-2.5">{t("Donor # / Group", "عطیہ دہندہ و گروپ")}</th>
                    <th className="p-2.5">{t("Collection Details", "حصول کی تفصیل")}</th>
                    <th className="p-2.5">{t("Elapsed / 8h Limit", "گزرے گھنٹے / 8 گھنٹے حد")}</th>
                    <th className="p-2.5">{t("Testing Status", "ٹیسٹنگ کی حالت")}</th>
                    <th className="p-2.5 text-right">{t("Actions", "اقدامات")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {collectedDonations.map((don) => {
                    const timeExceeded = isProcessingTimeExceeded(don.collection_ended_at);
                    const elapsedHours = don.collection_ended_at
                      ? Math.round(
                          ((Date.now() - new Date(don.collection_ended_at).getTime()) / (1000 * 60 * 60)) * 10
                        ) / 10
                      : null;

                    return (
                      <tr key={don.donation_id} className="hover:bg-slate-50" data-help="blood_center_lab.row_donation">
                        <td className="p-2.5 font-mono font-medium text-slate-900">
                          <div>{don.donation_number}</div>
                          <span className="text-[10px] text-slate-500">ID: {don.donation_id}</span>
                        </td>
                        <td className="p-2.5">
                          <div className="font-semibold text-slate-800">{don.donor_number}</div>
                          <div className="text-[11px] text-slate-500">
                            {don.donor_sex}, {don.age_years}y | {don.donation_kind}
                          </div>
                        </td>
                        <td className="p-2.5">
                          <div className="font-semibold text-slate-800">
                            {don.volume_ml} mL ({don.bag_type})
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Lot: {don.bag_lot} | {don.anticoagulant}
                          </div>
                        </td>
                        <td className="p-2.5">
                          <div>{elapsedHours !== null ? `${elapsedHours} hrs ago` : "-"}</div>
                          {timeExceeded && (
                            <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                              {t("> 8h Elapsed", "8 گھنٹے سے زائد")}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5">
                          {don.reactive_markers && don.reactive_markers.length > 0 ? (
                            <span className="inline-block rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                              REACTIVE: {don.reactive_markers.join(", ")}
                            </span>
                          ) : don.abo && don.rh ? (
                            <span className="inline-block rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              Grouped: {don.abo} {don.rh}
                            </span>
                          ) : (
                            <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                              Awaiting Tests
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-right space-x-1.5">
                          {/* Inspect full history */}
                          <button
                            type="button"
                            onClick={() => handleOpenInspect(don.donation_id)}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                            data-help="blood_center_lab.btn_inspect_donation"
                          >
                            {t("Inspect", "معائنہ")}
                          </button>

                          {/* Record Tests (rule:9f918de113) */}
                          {canRecordTestsAction && (
                            <button
                              type="button"
                              onClick={() => handleOpenTests(don)}
                              className="rounded border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                              data-help="blood_center_lab.btn_open_tests"
                            >
                              {t("Record Tests", "ٹیسٹ درج کریں")}
                            </button>
                          )}

                          {/* Prepare Components (rule:6dab3d3a8e) */}
                          {canPrepareAction && (
                            <button
                              type="button"
                              onClick={() => handleOpenPrep(don)}
                              className="rounded bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                              data-help="blood_center_lab.btn_open_prep"
                            >
                              {t("Separate Components", "اجزاء تیار کریں")}
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

      {/* TAB 2: QUARANTINE INVENTORY & DISCARDS (rule:7e769d8e04, rule:87598ad7aa) */}
      {activeTab === "quarantine" && (
        <div className="space-y-3" data-help="blood_center_lab.quarantine_section">
          {/* Sub-filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 p-2.5">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <span>{t("Filter Quarantine Status:", "قرنطینہ فلٹر:")}</span>
              <select
                value={quarantineFilter}
                onChange={(e) => setQuarantineFilter(e.target.value as any)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                data-help="blood_center_lab.filter_quarantine_status"
              >
                <option value="Quarantine">{t("In Quarantine Only", "صرف قرنطینہ میں")}</option>
                <option value="All">{t("All Components", "تمام اجزاء")}</option>
                <option value="Discarded">{t("Discarded Archive", "تلف شدہ اجزاء")}</option>
                <option value="Released">{t("Released Units", "جاری شدہ یونٹس")}</option>
              </select>
            </div>
            <span className="text-xs text-slate-500">
              {t("PBTA Rule: Reactive units must be isolated and discarded promptly.", "پی بی ٹی اے قانون: ری ایکٹیو یونٹس کو فوری الگ کر کے تلف کیا جائے۔")}
            </span>
          </div>

          <LoadState
            loading={componentsState.loading}
            error={componentsState.error}
            retry={componentsState.reload}
          />

          {!componentsState.loading && !componentsState.error && quarantineComponents.length === 0 && (
            <div data-help="blood_center_lab.empty_quarantine">
              <Empty>
                <span className="font-semibold block">{t("No Components Found", "کوئی جزو دستیاب نہیں")}</span>
                <span className="text-xs text-slate-500 block mt-1">
                  {t("Separated blood components placed into quarantine will appear here.", "علیحدہ کیے گئے بلڈ بیگز یہاں قرنطینہ میں ظاہر ہوں گے۔")}
                </span>
                <button
                  type="button"
                  onClick={() => setRevision((r) => r + 1)}
                  className="mt-2 text-xs text-rose-600 underline"
                  data-help="blood_center_lab.btn_quarantine_refresh"
                >
                  {t("Refresh", "تازہ کریں")}
                </button>
              </Empty>
            </div>
          )}

          {!componentsState.loading && !componentsState.error && quarantineComponents.length > 0 && (
            <div className="overflow-x-auto rounded border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs text-slate-700" data-help="blood_center_lab.table_quarantine">
                <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-800">
                  <tr>
                    <th className="p-2.5">{t("Component #", "جزو نمبر")}</th>
                    <th className="p-2.5">{t("Donation #", "عطیہ نمبر")}</th>
                    <th className="p-2.5">{t("Component Type", "جزو کی قسم")}</th>
                    <th className="p-2.5">{t("Volume / Expiry", "مقدار و میعاد")}</th>
                    <th className="p-2.5">{t("Quarantine State", "قرنطینہ حالت")}</th>
                    <th className="p-2.5">{t("Discard / Release Note", "تلفی یا کلیئرنس")}</th>
                    <th className="p-2.5 text-right">{t("Actions", "اقدامات")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quarantineComponents.map((c) => (
                    <tr
                      key={c.component_id}
                      className={`hover:bg-slate-50 ${c.status === "Discarded" ? "opacity-60 bg-slate-50" : ""}`}
                      data-help="blood_center_lab.row_component"
                    >
                      <td className="p-2.5 font-mono font-medium text-slate-900">
                        <div>CMP-{c.component_id}</div>
                        <span className="text-[10px] text-slate-500">ID: {c.component_id}</span>
                      </td>
                      <td className="p-2.5 font-mono text-slate-700">{c.donation_number}</td>
                      <td className="p-2.5">
                        <span className="font-semibold text-slate-900">{c.component}</span>
                        {c.parent_component_id && (
                          <div className="text-[10px] text-slate-400">Parent ID: {c.parent_component_id}</div>
                        )}
                      </td>
                      <td className="p-2.5">
                        <div className="font-semibold text-slate-800">{c.volume_ml} mL</div>
                        <div className="text-[10px] text-slate-500">
                          Expires: {new Date(c.expires_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                            c.status === "Quarantine"
                              ? "bg-amber-100 text-amber-800"
                              : c.status === "Released"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="p-2.5 text-[11px]">
                        {c.discard_reason ? (
                          <div className="text-rose-700">
                            <strong>{c.discard_reason}</strong>
                            {c.discard_note && <div className="text-[10px] text-slate-500">{c.discard_note}</div>}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-2.5 text-right space-x-1.5">
                        {/* View Component Label */}
                        <button
                          type="button"
                          onClick={() => handleOpenComponentLabel(c.component_id)}
                          className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700 hover:bg-slate-50"
                          data-help="blood_center_lab.btn_component_label"
                        >
                          {t("Label", "لیبل")}
                        </button>

                        {/* Discard Component (rule:87598ad7aa) */}
                        {c.status === "Quarantine" && canProcess && (
                          <button
                            type="button"
                            onClick={() => handleOpenDiscard(c)}
                            className="rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                            data-help="blood_center_lab.btn_open_discard"
                          >
                            {t("Discard", "تلف کریں")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: RECORD LABORATORY TESTS (rule:ac0462c02a, rule:7e769d8e04) */}
      {testsModalOpen && targetDonationForTests && (
        <Modal
          title={t("Record TTI Screening & ABO/Rh Determinations", "متعدی بیماریوں اور بلڈ گروپ کے ٹیسٹ کا اندراج")}
          onClose={() => setTestsModalOpen(false)}
        >
          <form onSubmit={handleSubmitTests} className="space-y-4 text-xs text-slate-800" data-help="blood_center_lab.modal_tests">
            <ClinicalWriteFeedback write={write} />

            {/* Header info */}
            <div className="rounded border border-slate-200 bg-slate-50 p-2.5 flex items-center justify-between">
              <div>
                <span className="font-mono font-bold text-slate-900">{targetDonationForTests.donation_number}</span>
                <span className="ml-2 text-slate-500">Donor: {targetDonationForTests.donor_number}</span>
              </div>
              <div className="text-slate-600">
                {targetDonationForTests.donor_sex}, {targetDonationForTests.age_years}y | {targetDonationForTests.volume_ml} mL ({targetDonationForTests.bag_type})
              </div>
            </div>

            {/* Instructions */}
            <div className="rounded border border-blue-200 bg-blue-50 p-2 text-blue-900 text-[11px]">
              {t(
                "PBTA Standards Mandate: All 5 TTI screens must be performed. ABO Forward, Reverse, and RhD must each be tested twice using agreeing determinations. The result field starts blank.",
                "پی بی ٹی اے کے تحت تمام 5 متعدی امراض کی اسکریننگ اور بلڈ گروپ کے دوہرے متفقہ ٹیسٹ لازمی ہیں۔ نتیجے کا خانہ خالی شروع ہوتا ہے۔"
              )}
            </div>

            {testsError && <ErrorBox error={testsError} />}

            {/* Test Grid */}
            <div className="overflow-x-auto rounded border border-slate-200 bg-white">
              <table className="w-full text-left text-xs" data-help="blood_center_lab.table_test_grid">
                <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-800">
                  <tr>
                    <th className="p-2">{t("Test Marker", "ٹیسٹ مارکر")}</th>
                    <th className="p-2">{t("Sample", "نمونہ")}</th>
                    <th className="p-2">{t("Testing Method", "طریقہ کار")}</th>
                    <th className="p-2">{t("Kit Lot #", "کٹ لاٹ نمبر")}</th>
                    <th className="p-2">{t("Result", "نتیجہ")}</th>
                    <th className="p-2 text-right">{t("Action", "عمل")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {testRows.map((row, idx) => {
                    const isTTI = ["HBsAg", "AntiHCV", "AntiHIV", "Syphilis", "Malaria"].includes(row.marker);
                    const isABO = ["ABOForward", "ABOReverse"].includes(row.marker);
                    const isRh = row.marker === "RhD";

                    return (
                      <tr
                        key={`${row.marker}-${idx}`}
                        className={`hover:bg-slate-50 ${row.result === "Reactive" ? "bg-rose-50" : ""}`}
                        data-help="blood_center_lab.row_test_entry"
                      >
                        <td className="p-2 font-semibold text-slate-800">
                          {row.marker}
                        </td>
                        <td className="p-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${
                              row.sample === "Repeat" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {row.sample || "Initial"}
                          </span>
                        </td>
                        <td className="p-2">
                          <select
                            value={row.method}
                            onChange={(e) => {
                              const val = e.target.value as any;
                              setTestRows((rows) => {
                                const next = [...rows];
                                next[idx] = { ...next[idx], method: val };
                                return next;
                              });
                            }}
                            className="rounded border border-slate-300 bg-white p-1 text-xs"
                            data-help="blood_center_lab.select_test_method"
                          >
                            <option value="ELISA">ELISA</option>
                            <option value="CLIA">CLIA</option>
                            <option value="Rapid">Rapid</option>
                            <option value="Microscopy">Microscopy</option>
                            <option value="Slide">Slide</option>
                            <option value="Tube">Tube</option>
                            <option value="Gel">Gel</option>
                            <option value="Other">Other</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.kit_lot || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTestRows((rows) => {
                                const next = [...rows];
                                next[idx] = { ...next[idx], kit_lot: val };
                                return next;
                              });
                            }}
                            className="w-24 rounded border border-slate-300 p-1 font-mono text-xs"
                            data-help="blood_center_lab.input_kit_lot"
                          />
                        </td>
                        <td className="p-2">
                          {isTTI && (
                            <select
                              value={row.result || ""}
                              onChange={(e) => {
                                const val = e.target.value as any;
                                setTestRows((rows) => {
                                  const next = [...rows];
                                  next[idx] = { ...next[idx], result: val };
                                  return next;
                                });
                              }}
                              className={`rounded border p-1 text-xs font-semibold ${
                                row.result === "Reactive"
                                  ? "border-rose-400 bg-rose-50 text-rose-800"
                                  : "border-slate-300 bg-white text-slate-800"
                              }`}
                              data-help="blood_center_lab.select_tti_result"
                            >
                              <option value="">{t("-- Select Result --", "-- نتیجہ منتخب کریں --")}</option>
                              <option value="NonReactive">{t("Non-Reactive", "منفی (نان ری ایکٹیو)")}</option>
                              <option value="Reactive">{t("REACTIVE", "مثبت (ری ایکٹیو)")}</option>
                            </select>
                          )}

                          {isABO && (
                            <select
                              value={row.result || ""}
                              onChange={(e) => {
                                const val = e.target.value as any;
                                setTestRows((rows) => {
                                  const next = [...rows];
                                  next[idx] = { ...next[idx], result: val };
                                  return next;
                                });
                              }}
                              className="rounded border border-slate-300 bg-white p-1 text-xs font-semibold"
                              data-help="blood_center_lab.select_abo_result"
                            >
                              <option value="">{t("-- Group --", "-- گروپ --")}</option>
                              <option value="A">Group A</option>
                              <option value="B">Group B</option>
                              <option value="AB">Group AB</option>
                              <option value="O">Group O</option>
                            </select>
                          )}

                          {isRh && (
                            <select
                              value={row.result || ""}
                              onChange={(e) => {
                                const val = e.target.value as any;
                                setTestRows((rows) => {
                                  const next = [...rows];
                                  next[idx] = { ...next[idx], result: val };
                                  return next;
                                });
                              }}
                              className="rounded border border-slate-300 bg-white p-1 text-xs font-semibold"
                              data-help="blood_center_lab.select_rh_result"
                            >
                              <option value="">{t("-- Rh --", "-- آر ایچ --")}</option>
                              <option value="Positive">Rh Positive (+)</option>
                              <option value="Negative">Rh Negative (-)</option>
                            </select>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          {/* rule:7e769d8e04: Offer repeat test row on another sample from the bag */}
                          {row.result === "Reactive" && (
                            <button
                              type="button"
                              onClick={() => handleAddRepeatTest(row.marker)}
                              className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-rose-700"
                              data-help="blood_center_lab.btn_add_repeat_test"
                            >
                              {t("Repeat from Bag", "بیگ سے دوبارہ نمونہ لیں")}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setTestsModalOpen(false)}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                data-help="blood_center_lab.btn_cancel_tests"
              >
                {t("Cancel", "منسوخ")}
              </button>
              <button
                type="submit"
                disabled={write.busy}
                className="rounded bg-indigo-600 px-4 py-1.5 font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                data-help="blood_center_lab.btn_submit_tests"
              >
                {write.busy ? t("Saving Tests...", "محفوظ ہو رہا ہے...") : t("Save Lab Test Results", "ٹیسٹ نتائج محفوظ کریں")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 2: COMPONENT PREPARATION (rule:22b4758a41, rule:6dab3d3a8e) */}
      {componentsModalOpen && targetDonationForPrep && (
        <Modal
          title={t("Separate Blood Components into Quarantine", "بلڈ کمپوننٹس کی تیاری اور قرنطینہ")}
          onClose={() => setComponentsModalOpen(false)}
        >
          <form onSubmit={handleSubmitPrep} className="space-y-4 text-xs text-slate-800" data-help="blood_center_lab.modal_prep">
            <ClinicalWriteFeedback write={write} />

            {/* Donation info & 8-hour alert */}
            <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-slate-900">{targetDonationForPrep.donation_number}</span>
                  <span className="ml-2 text-slate-500">Pack: {targetDonationForPrep.bag_type} ({targetDonationForPrep.anticoagulant})</span>
                </div>
                <div className="font-semibold text-slate-800">
                  Collected: {targetDonationForPrep.volume_ml} mL
                </div>
              </div>
              {isProcessingTimeExceeded(targetDonationForPrep.collection_ended_at) && (
                <div className="mt-2 rounded bg-amber-100 p-2 text-amber-900 font-semibold text-[11px]">
                  {t(
                    "Warning: More than 8 hours have elapsed since venepuncture. Platelets and fresh plasma must not be separated from delayed units (PBTA rule 22b4758a41: BLOOD_PROCESSING_TIME_EXCEEDED).",
                    "انتباہ: خون نکالے 8 گھنٹے سے زائد ہو چکے ہیں۔ تاخیر کی صورت میں پلیٹ لیٹس اور تازہ پلازما تیار نہیں کیے جا سکتے۔"
                  )}
                </div>
              )}
            </div>

            {prepError && <ErrorBox error={prepError} />}

            {/* Preparation Mode Selection */}
            <Field label={t("Processing Strategy", "پروسیسنگ کا طریقہ")}>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="prepMode"
                    value="Separated"
                    checked={prepMode === "Separated"}
                    onChange={() => setPrepMode("Separated")}
                    className="text-rose-600 focus:ring-rose-500"
                    data-help="blood_center_lab.radio_mode_separated"
                  />
                  <span className="font-semibold text-slate-900">{t("Separate Components (Red Cells, Plasma, Platelets)", "اجزاء میں تقسیم کریں")}</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="prepMode"
                    value="WholeBlood"
                    checked={prepMode === "WholeBlood"}
                    onChange={() => setPrepMode("WholeBlood")}
                    className="text-rose-600 focus:ring-rose-500"
                    data-help="blood_center_lab.radio_mode_whole"
                  />
                  <span className="font-semibold text-slate-900">{t("Keep as Whole Blood", "ہول بلڈ برقرار رکھیں")}</span>
                </label>
              </div>
            </Field>

            {/* SECTION: WHOLE BLOOD */}
            {prepMode === "WholeBlood" && (
              <div className="rounded border border-slate-200 bg-white p-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("Volume (mL)", "مقدار (ملی لیٹر)")}>
                    <input
                      type="number"
                      value={wbVolume}
                      onChange={(e) => setWbVolume(e.target.value)}
                      className="w-full rounded border border-slate-300 p-1.5 text-xs font-mono"
                      data-help="blood_center_lab.input_wb_volume"
                    />
                  </Field>
                  <Field label={t("Expiry Date & Time", "میعاد ختم ہونے کا وقت")}>
                    <input
                      type="datetime-local"
                      value={wbExpiry}
                      onChange={(e) => setWbExpiry(e.target.value)}
                      className="w-full rounded border border-slate-300 p-1.5 text-xs"
                      data-help="blood_center_lab.input_wb_expiry"
                    />
                  </Field>
                </div>
              </div>
            )}

            {/* SECTION: SEPARATED COMPONENTS */}
            {prepMode === "Separated" && (
              <div className="space-y-3">
                {/* Red Cells */}
                <div className="rounded border border-slate-200 bg-white p-2.5">
                  <span className="font-bold text-slate-900">Packed Red Blood Cells (PRBC)</span>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <Field label={t("Volume (mL)", "مقدار (ملی لیٹر)")}>
                      <input
                        type="number"
                        value={prbcVolume}
                        onChange={(e) => setPrbcVolume(e.target.value)}
                        className="w-full rounded border border-slate-300 p-1 text-xs font-mono"
                        data-help="blood_center_lab.input_prbc_volume"
                      />
                    </Field>
                    <Field label={t("Expiry (35d CPDA-1)", "میعاد")}>
                      <input
                        type="datetime-local"
                        value={prbcExpiry}
                        onChange={(e) => setPrbcExpiry(e.target.value)}
                        className="w-full rounded border border-slate-300 p-1 text-xs"
                        data-help="blood_center_lab.input_prbc_expiry"
                      />
                    </Field>
                  </div>
                </div>

                {/* Fresh Frozen Plasma */}
                <div className="rounded border border-slate-200 bg-white p-2.5">
                  <span className="font-bold text-slate-900">Fresh Frozen Plasma (FFP)</span>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <Field label={t("Volume (mL)", "مقدار (ملی لیٹر)")}>
                      <input
                        type="number"
                        value={ffpVolume}
                        onChange={(e) => setFfpVolume(e.target.value)}
                        className="w-full rounded border border-slate-300 p-1 text-xs font-mono"
                        data-help="blood_center_lab.input_ffp_volume"
                      />
                    </Field>
                    <Field label={t("Expiry (12 months at -25°C)", "میعاد")}>
                      <input
                        type="datetime-local"
                        value={ffpExpiry}
                        onChange={(e) => setFfpExpiry(e.target.value)}
                        className="w-full rounded border border-slate-300 p-1 text-xs"
                        data-help="blood_center_lab.input_ffp_expiry"
                      />
                    </Field>
                  </div>
                </div>

                {/* Platelets */}
                <div className="rounded border border-slate-200 bg-white p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Platelet Concentrate (PC)</span>
                    <label className="flex items-center gap-1 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={includePlatelets}
                        onChange={(e) => setIncludePlatelets(e.target.checked)}
                        data-help="blood_center_lab.check_include_platelets"
                      />
                      <span>{t("Prepare Platelets", "پلیٹ لیٹس تیار کریں")}</span>
                    </label>
                  </div>
                  {includePlatelets && (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <Field label={t("Volume (mL)", "مقدار (ملی لیٹر)")}>
                        <input
                          type="number"
                          value={pltVolume}
                          onChange={(e) => setPltVolume(e.target.value)}
                          className="w-full rounded border border-slate-300 p-1 text-xs font-mono"
                          data-help="blood_center_lab.input_plt_volume"
                        />
                      </Field>
                      <Field label={t("Expiry (5 days at 22°C)", "میعاد")}>
                        <input
                          type="datetime-local"
                          value={pltExpiry}
                          onChange={(e) => setPltExpiry(e.target.value)}
                          className="w-full rounded border border-slate-300 p-1 text-xs"
                          data-help="blood_center_lab.input_plt_expiry"
                        />
                      </Field>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setComponentsModalOpen(false)}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                data-help="blood_center_lab.btn_cancel_prep"
              >
                {t("Cancel", "منسوخ")}
              </button>
              <button
                type="submit"
                disabled={write.busy}
                className="rounded bg-rose-600 px-4 py-1.5 font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                data-help="blood_center_lab.btn_submit_prep"
              >
                {write.busy ? t("Placing in Quarantine...", "قرنطینہ میں محفوظ ہو رہا ہے...") : t("Transfer into Quarantine", "قرنطینہ میں منتقل کریں")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 3: DISCARD COMPONENT IN QUARANTINE (rule:87598ad7aa) */}
      {discardModalOpen && targetComponentForDiscard && (
        <Modal
          title={t("Discard Quarantine Blood Component", "قرنطینہ بلڈ کمپوننٹ کی تلفی")}
          onClose={() => setDiscardModalOpen(false)}
        >
          <form onSubmit={handleSubmitDiscard} className="space-y-4 text-xs text-slate-800" data-help="blood_center_lab.modal_discard">
            <ClinicalWriteFeedback write={write} />

            <div className="rounded border border-rose-200 bg-rose-50 p-2.5">
              <div className="font-semibold text-rose-900">
                Component #{targetComponentForDiscard.component_id} ({targetComponentForDiscard.component}, {targetComponentForDiscard.volume_ml} mL)
              </div>
              <div className="text-[11px] text-rose-700 mt-0.5">
                Donation: {targetComponentForDiscard.donation_number}
              </div>
            </div>

            {discardError && <ErrorBox error={discardError} />}

            <Field label={t("Reason for Discard", "تلفی کی وجہ")}>
              <select
                value={discardReason}
                onChange={(e) => setDiscardReason(e.target.value)}
                className="w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-800"
                data-help="blood_center_lab.select_discard_reason"
              >
                {COMPONENT_DISCARD_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.labelEn}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t("Clinical Note / Explanation", "طبی وضاحت و نوٹ")} hint={discardReason === "Other" ? "Required for 'Other' reason" : undefined}>
              <textarea
                rows={2}
                maxLength={500}
                value={discardNote}
                onChange={(e) => setDiscardNote(e.target.value)}
                placeholder={t("Document explanation for component discard...", "تلفی کی وجہ درج کریں...")}
                className="w-full rounded border border-slate-300 p-1.5 text-xs"
                data-help="blood_center_lab.textarea_discard_note"
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setDiscardModalOpen(false)}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                data-help="blood_center_lab.btn_cancel_discard"
              >
                {t("Cancel", "منسوخ")}
              </button>
              <button
                type="submit"
                disabled={write.busy}
                className="rounded bg-rose-700 px-4 py-1.5 font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
                data-help="blood_center_lab.btn_submit_discard"
              >
                {write.busy ? t("Discarding...", "تلف ہو رہا ہے...") : t("Confirm Discard", "تلفی کی تصدیق کریں")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 4: COMPONENT LABEL PREVIEW */}
      {labelModalOpen && (
        <Modal
          title={t("Blood Component Quarantine Label", "بلڈ کمپوننٹ کا قرنطینہ لیبل")}
          onClose={() => setLabelModalOpen(false)}
        >
          <div className="space-y-4 text-xs text-slate-700" data-help="blood_center_lab.modal_component_label">
            {loadingLabel && <div className="py-6 text-center text-slate-500">{t("Loading label...", "لیبل لوڈ ہو رہا ہے...")}</div>}
            {labelError && <ErrorBox error={labelError} />}

            {labelData && (
              <div className="rounded border border-slate-300 bg-slate-50 p-3 space-y-2">
                <div className="flex justify-between border-b pb-2">
                  <span className="font-bold text-slate-900">{labelData.document_type}</span>
                  <span className="text-indigo-700 font-semibold">{labelData.printer_role} ({labelData.paper_width_mm}mm)</span>
                </div>
                {labelData.barcode_svg && (
                  <div className="rounded bg-white p-2 border flex justify-center">
                    <div dangerouslySetInnerHTML={{ __html: labelData.barcode_svg }} />
                  </div>
                )}
                {labelData.text && (
                  <pre className="overflow-x-auto rounded bg-slate-900 p-2 font-mono text-[11px] text-green-400">
                    {labelData.text}
                  </pre>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setLabelModalOpen(false)}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                data-help="blood_center_lab.btn_close_label"
              >
                {t("Close", "بند کریں")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 5: INSPECT DONATION DETAILS */}
      {inspectModalOpen && (
        <Modal
          title={t("Donation Inspection & History", "عطیہ کی مکمل تفصیلات و تاریخ")}
          onClose={() => setInspectModalOpen(false)}
        >
          <div className="space-y-4 text-xs text-slate-800" data-help="blood_center_lab.modal_inspect">
            {loadingInspection && <div className="py-6 text-center text-slate-500">{t("Loading details...", "تفصیلات لوڈ ہو رہی ہیں...")}</div>}

            {selectedDonation && (
              <div className="space-y-3">
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="flex justify-between font-mono font-bold text-slate-900">
                    <span>{selectedDonation.donation_number}</span>
                    <span className="text-rose-700">{selectedDonation.status}</span>
                  </div>
                  <div className="mt-1 text-slate-600">
                    Donor: {selectedDonation.donor_number} | {selectedDonation.donor_sex}, {selectedDonation.age_years}y | {selectedDonation.donation_kind}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Weight: {selectedDonation.weight_kg} kg | Hb: {selectedDonation.hb_g_dl} g/dL | Volume: {selectedDonation.volume_ml} mL
                  </div>
                </div>

                {/* Tests performed */}
                <div>
                  <span className="font-bold text-slate-900 block mb-1">{t("Laboratory Test Results", "لیب ٹیسٹ نتائج")}</span>
                  {selectedDonation.tests && selectedDonation.tests.length > 0 ? (
                    <div className="rounded border border-slate-200 bg-white divide-y divide-slate-100">
                      {selectedDonation.tests.map((tItem, idx) => (
                        <div key={idx} className="p-2 flex justify-between items-center text-[11px]">
                          <div>
                            <span className="font-semibold">{tItem.marker}</span> ({tItem.sample || "Initial"}, {tItem.method})
                          </div>
                          <div>
                            <span
                              className={`rounded px-1.5 py-0.5 font-semibold ${
                                tItem.result === "Reactive"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {tItem.result}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-500 italic p-2 bg-slate-50 rounded border">{t("No tests recorded yet.", "ابھی تک کوئی ٹیسٹ درج نہیں ہے۔")}</div>
                  )}
                </div>

                {/* Components separated */}
                <div>
                  <span className="font-bold text-slate-900 block mb-1">{t("Separated Components", "تیار شدہ اجزاء")}</span>
                  {selectedDonation.components && selectedDonation.components.length > 0 ? (
                    <div className="rounded border border-slate-200 bg-white divide-y divide-slate-100">
                      {selectedDonation.components.map((cItem) => (
                        <div key={cItem.component_id} className="p-2 flex justify-between items-center text-[11px]">
                          <div>
                            <span className="font-semibold">{cItem.component}</span> ({cItem.volume_ml} mL)
                          </div>
                          <div>
                            <span
                              className={`rounded px-1.5 py-0.5 font-semibold ${
                                cItem.status === "Quarantine"
                                  ? "bg-amber-100 text-amber-800"
                                  : cItem.status === "Released"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {cItem.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-500 italic p-2 bg-slate-50 rounded border">{t("No components separated yet.", "ابھی تک کوئی جزو تیار نہیں کیا گیا۔")}</div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t">
              <button
                type="button"
                onClick={() => setInspectModalOpen(false)}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                data-help="blood_center_lab.btn_close_inspect"
              >
                {t("Close", "بند کریں")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
