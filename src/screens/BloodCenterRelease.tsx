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
  CenterComponentOut,
  DonationDetailOut,
  DonationOut,
  DonationClearanceIn,
  ComponentReleaseIn,
  PrintOut_BloodComponentLabelFieldsOut_,
  BloodUnitTraceOut,
} from "../generated/blood_center_release";
import {
  listDonations,
  getDonation,
  clear,
  listComponents,
  release,
  componentLabel,
  getUnit,
} from "../generated/blood_center_release";
import {
  getBloodCenterReleaseScreenView,
  isBloodCenterActiveOrRetiring,
  evaluateDonationClearance,
  validateDualControlInput,
  explainReleaseError,
} from "../blood-center-release-policy";
import { useClinicalWrite, ClinicalWriteFeedback } from "../clinical-write";

export function BloodCenterRelease({
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
  const view = getBloodCenterReleaseScreenView(establishment);
  const activeOrRetiring = isBloodCenterActiveOrRetiring(establishment);
  const canView = user.permissions?.includes("blood_center.view") ?? false;
  const canRelease = user.permissions?.includes("blood_center.release") ?? false;

  const [activeTab, setActiveTab] = useState<"clearance" | "quarantine" | "trace">("clearance");
  const [revision, setRevision] = useState(0);
  const [realtimeAlert, setRealtimeAlert] = useState<string | null>(null);

  // Clearance tab state
  const [clearanceStatusFilter, setClearanceStatusFilter] = useState<
    "Collected" | "Cleared" | "Reactive" | "Rejected" | "All"
  >("Collected");
  const [donationSearchQuery, setDonationSearchQuery] = useState("");

  // Inspection modal state
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState<DonationDetailOut | null>(null);
  const [loadingInspection, setLoadingInspection] = useState(false);

  // Clearance action modal state
  const [clearanceModalOpen, setClearanceModalOpen] = useState(false);
  const [targetDonation, setTargetDonation] = useState<DonationDetailOut | null>(null);
  const [clearanceOutcome, setClearanceOutcome] = useState<"Cleared" | "Reactive" | "Rejected">("Cleared");
  const [clearanceNote, setClearanceNote] = useState("");
  const [clearanceValidationMsg, setClearanceValidationMsg] = useState<string | null>(null);

  // Quarantine release tab state
  const [quarantineFilter, setQuarantineFilter] = useState<"Quarantine" | "Released" | "Discarded" | "All">("Quarantine");
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [targetComponent, setTargetComponent] = useState<CenterComponentOut | null>(null);
  const [componentLabelData, setComponentLabelData] = useState<PrintOut_BloodComponentLabelFieldsOut_ | null>(null);
  const [loadingLabel, setLoadingLabel] = useState(false);
  const [labelPrinted, setLabelPrinted] = useState(false);

  // Dual control credentials (rule:1e77b26ed6 - never prefilled)
  const [checkerUsername, setCheckerUsername] = useState("");
  const [checkerPassword, setCheckerPassword] = useState("");
  const [dualControlError, setDualControlError] = useState<string | null>(null);
  const [releaseSuccessResult, setReleaseSuccessResult] = useState<CenterComponentOut | null>(null);

  // Blood Unit Trace tab state
  const [traceUnitIdInput, setTraceUnitIdInput] = useState<string>("");
  const [tracedUnit, setTracedUnit] = useState<BloodUnitTraceOut | null>(null);
  const [loadingTrace, setLoadingTrace] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);

  // Clinical write controller
  const write = useClinicalWrite(user, "blood_center_release", (value: any, cmd) => {
    setRevision((r) => r + 1);
    if (cmd.path.includes("/clearance")) {
      setClearanceModalOpen(false);
      setTargetDonation(null);
    } else if (cmd.path.includes("/release")) {
      setReleaseSuccessResult(value as CenterComponentOut);
    }
  });

  // Real-time reactive event listener (rule:d1b6b7c78b)
  useEffect(() => {
    if (!stream) return;
    try {
      const parsed = JSON.parse(stream);
      if (parsed.event === "blood_center.donation.reactive" || parsed.topic === "blood_center.donation.reactive") {
        setRealtimeAlert("Urgent: Reactive screening result received. Worklists and quarantine inventory refreshed.");
        setRevision((r) => r + 1);
      }
    } catch {
      // Non-json stream line
    }
  }, [stream]);

  // Load donations for Clearance worklist
  const donationsLoad = useLoad(
    async () => {
      if (!canView) return [];
      const queryStatus = clearanceStatusFilter === "All" ? undefined : clearanceStatusFilter;
      return await listDonations({ status: queryStatus, limit: 100 });
    },
    [canView, clearanceStatusFilter, revision]
  );

  // Load components for Quarantine release
  const componentsLoad = useLoad(
    async () => {
      if (!canView) return [];
      const queryStatus = quarantineFilter === "All" ? undefined : quarantineFilter;
      return await listComponents({ status: queryStatus, limit: 100 });
    },
    [canView, quarantineFilter, revision]
  );

  const donations = (donationsLoad.data as DonationOut[] | undefined) || [];
  const components = (componentsLoad.data as CenterComponentOut[] | undefined) || [];

  // Open Inspection Modal
  const openDonationInspection = async (donationId: number) => {
    setLoadingInspection(true);
    setInspectModalOpen(true);
    try {
      const detail = await getDonation(donationId);
      setSelectedDonation(detail);
    } catch (err: unknown) {
      console.error("Failed to load donation details:", err);
    } finally {
      setLoadingInspection(false);
    }
  };

  // Open Clearance Action Modal
  const openClearanceModal = async (donationId: number) => {
    setLoadingInspection(true);
    try {
      const detail = await getDonation(donationId);
      setTargetDonation(detail);
      setClearanceNote(detail.clearance_note || "");
      const evalResult = evaluateDonationClearance(detail.tests || []);
      if (evalResult.isReactive) {
        setClearanceOutcome("Reactive");
        setClearanceValidationMsg("Reactive markers detected: PBTA rules require recording donation Reactive.");
      } else if (evalResult.hasDiscrepancy) {
        setClearanceOutcome("Rejected");
        setClearanceValidationMsg(`Grouping discrepancy detected: ${evalResult.discrepancies.join("; ")}.`);
      } else if (!evalResult.canClear) {
        setClearanceOutcome("Cleared");
        setClearanceValidationMsg(`Incomplete testing: missing ${evalResult.missingTests.join(", ")}.`);
      } else {
        setClearanceOutcome("Cleared");
        setClearanceValidationMsg(null);
      }
      setClearanceModalOpen(true);
    } catch (err: unknown) {
      console.error("Failed to load donation for clearance:", err);
    } finally {
      setLoadingInspection(false);
    }
  };

  // Submit Clearance
  const handleClearanceSubmit = async () => {
    if (!targetDonation) return;

    if (clearanceOutcome === "Rejected" && !clearanceNote.trim()) {
      setClearanceValidationMsg("A clinical explanation note is mandatory when rejecting a donation.");
      return;
    }

    const payload: DonationClearanceIn = {
      outcome: clearanceOutcome,
      note: clearanceNote.trim() ? clearanceNote.trim() : null,
    };

    write.start({
      method: "POST",
      path: `/blood-center/donations/${targetDonation.donation_id}/clearance`,
      body: payload,
      permission: "blood_center.release",
      protection: "idempotent",
      label: t("Donation Clearance", "عطیہ کی منظوری"),
    });
  };

  // Open Quarantine Release Modal
  const openReleaseModal = async (component: CenterComponentOut) => {
    setTargetComponent(component);
    setCheckerUsername("");
    setCheckerPassword("");
    setDualControlError(null);
    setLabelPrinted(false);
    setReleaseSuccessResult(null);
    setReleaseModalOpen(true);
    setLoadingLabel(true);

    try {
      const lbl = await componentLabel(component.component_id);
      setComponentLabelData(lbl);
    } catch (err: unknown) {
      console.error("Failed to fetch component label:", err);
    } finally {
      setLoadingLabel(false);
    }
  };

  // Print label action
  const handlePrintLabel = () => {
    setLabelPrinted(true);
  };

  // Submit Release with Dual Control
  const handleReleaseSubmit = async () => {
    if (!targetComponent) return;

    // Validate dual control input (rule:1e77b26ed6)
    const val = validateDualControlInput(checkerUsername, checkerPassword, user.username);
    if (!val.valid) {
      setDualControlError(val.error || "Dual control validation failed");
      return;
    }

    const payload: ComponentReleaseIn = {
      checker_username: checkerUsername.trim(),
      checker_password: checkerPassword.trim(),
    };

    write.start({
      method: "POST",
      path: `/blood-center/components/${targetComponent.component_id}/release`,
      body: payload,
      permission: "blood_center.release",
      protection: "idempotent",
      label: t("Component Release", "جز کا اخراج"),
    });
  };

  // Lookup Unit in Trace Tab
  const handleTraceLookup = async (unitIdToLookup?: number) => {
    const id = unitIdToLookup ?? parseInt(traceUnitIdInput, 10);
    if (isNaN(id) || id <= 0) {
      setTraceError("Please enter a valid numeric Blood Bank Unit ID.");
      return;
    }
    setLoadingTrace(true);
    setTraceError(null);
    try {
      const unit = await getUnit(id);
      setTracedUnit(unit);
      setTraceUnitIdInput(String(id));
      setActiveTab("trace");
    } catch {
      setTracedUnit(null);
      setTraceError("Blood Bank unit not found or not accessible (404 Not Found).");
    } finally {
      setLoadingTrace(false);
    }
  };

  if (!canView) {
    return (
      <div className="p-6">
        <ErrorBox
          error={t(
            "Access Denied: You do not hold 'blood_center.view' permission required to view blood center release.",
            "رسائی مسترد: آپ کے پاس بلڈ سنٹر ریلیز دیکھنے کی اجازت نہیں ہے۔"
          )}
        />
      </div>
    );
  }

  const isReadOnly = view === "records";
  const isRetiring = view === "open_work";

  const filteredDonations = donations.filter((d) => {
    if (!donationSearchQuery.trim()) return true;
    const q = donationSearchQuery.toLowerCase();
    return (
      d.donation_number.toLowerCase().includes(q) ||
      d.donor_number.toLowerCase().includes(q) ||
      d.donor_sex.toLowerCase().includes(q) ||
      (d.abo && d.abo.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {t("Blood Center Release to Inventory", "بلڈ سنٹر انوینٹری ریلیز")}
            </h1>
            <span
              className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                activeOrRetiring
                  ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              }`}
            >
              {establishment.profile?.label || "Blood Center"}
            </span>
            <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded font-mono">
              Position 80
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t(
              "Punjab Blood Transfusion Authority (PBTA) medical clearance, dual-control quarantine release, and full vein-to-vein unit traceability.",
              "پنجاب بلڈ ٹرانسفیوژن اتھارٹی (پی بی ٹی اے) طبی منظوری، دوہرا تصدیقی قرنطینہ اخراج، اور مکمل رگ تا رگ ٹریس ایبلٹی۔"
            )}
          </p>
        </div>

        {/* Global Action / Refresh */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRevision((r) => r + 1)}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
            data-help="blood_center_release.refresh"
          >
            {t("Refresh", "تازہ کریں")}
          </button>
        </div>
      </div>

      {/* Retiring Notice (rule:e8afafb775, rule:e4772411e5) */}
      {isRetiring && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-lg text-amber-800 dark:text-amber-200 text-sm flex items-center justify-between">
          <span>
            {t(
              "No new blood center releases from now on (Blood Center service is Retiring). Existing quarantine units can still be released or discarded.",
              "اب سے کوئی نیا بلڈ سنٹر اخراج نہیں کیا جا سکتا (بلڈ سنٹر سروس ریٹائر ہو رہی ہے)۔ موجودہ قرنطینہ اجزاء ریلیز یا ضائع کیے جا سکتے ہیں۔"
            )}
          </span>
          <span className="font-semibold text-xs uppercase px-2 py-1 bg-amber-200 dark:bg-amber-800 rounded">
            Retiring Mode
          </span>
        </div>
      )}

      {/* Read-only Records Notice */}
      {isReadOnly && (
        <div className="p-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-gray-700 dark:text-gray-300 text-xs">
          {t(
            "Service is Closed: View-only mode for audit history and traceability records.",
            "سروس بند ہے: آڈٹ ریکارڈ اور ٹریس ایبلٹی کے لیے صرف دیکھنے کی اجازت ہے۔"
          )}
        </div>
      )}

      {/* Real-time reactive notification banner */}
      {realtimeAlert && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-700 rounded-md text-red-800 dark:text-red-200 text-sm flex items-center justify-between">
          <span>{realtimeAlert}</span>
          <button
            onClick={() => setRealtimeAlert(null)}
            className="text-xs font-semibold underline text-red-700 dark:text-red-300"
            data-help="blood_center_release.btn_dismiss_alert"
          >
            {t("Dismiss", "رد کریں")}
          </button>
        </div>
      )}

      {/* Main Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 space-x-4">
        <button
          onClick={() => setActiveTab("clearance")}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "clearance"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-semibold"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
          data-help="blood_center_release.tab_clearance"
        >
          {t("1. Donation Clearance & Screening", "۱. عطیہ کی جانچ و منظوری")}
          {donations.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              {donations.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("quarantine")}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "quarantine"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-semibold"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
          data-help="blood_center_release.tab_quarantine"
        >
          {t("2. Quarantine Release to Inventory", "۲. قرنطینہ سے انوینٹری اخراج")}
          {components.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              {components.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("trace")}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "trace"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-semibold"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
          data-help="blood_center_release.tab_trace"
        >
          {t("3. Blood Bank Unit Traceability", "۳. بلڈ بینک یونٹ ٹریس ایبلٹی")}
        </button>
      </div>

      {/* TAB 1: DONATION CLEARANCE WORKLIST */}
      {activeTab === "clearance" && (
        <div className="space-y-4">
          {/* Sub-bar: Filter by status + Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {t("Status Filter:", "اسٹیٹس فلٹر:")}
              </span>
              {(["Collected", "Cleared", "Reactive", "Rejected", "All"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setClearanceStatusFilter(st)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    clearanceStatusFilter === st
                      ? "bg-blue-600 text-white dark:bg-blue-500"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                  data-help="blood_center_release.filter_status"
                >
                  {st === "Collected"
                    ? t("Collected (Awaiting Clearance)", "جمع شدہ (منظوری کے منتظر)")
                    : st}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder={t("Search donation #, donor #, ABO...", "تلاش کریں...")}
                value={donationSearchQuery}
                onChange={(e) => setDonationSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                data-help="blood_center_release.donations_search_input"
              />
            </div>
          </div>

          {/* Donations Table */}
          <LoadState
            loading={donationsLoad.loading}
            error={donationsLoad.error}
            retry={donationsLoad.reload}
          />
          {!donationsLoad.loading && !donationsLoad.error && filteredDonations.length === 0 && (
            <Empty>
              <span>
                {t(
                  "No donations match the selected clearance filter.",
                  "منتخب کردہ فلٹر کے مطابق کوئی عطیات نہیں ملے۔"
                )}
              </span>
            </Empty>
          )}
          {!donationsLoad.loading && !donationsLoad.error && filteredDonations.length > 0 && (
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold">
                    <tr>
                      <th className="px-3 py-2.5 text-left">{t("Donation #", "عطیہ نمبر")}</th>
                      <th className="px-3 py-2.5 text-left">{t("Donor Info", "عطیہ دہندہ")}</th>
                      <th className="px-3 py-2.5 text-left">{t("Blood Group", "بلڈ گروپ")}</th>
                      <th className="px-3 py-2.5 text-left">{t("Collection", "خون کشی")}</th>
                      <th className="px-3 py-2.5 text-left">{t("Reactive Markers", "مثبت علامات")}</th>
                      <th className="px-3 py-2.5 text-left">{t("Status", "حالت")}</th>
                      <th className="px-3 py-2.5 text-right">{t("Actions", "اقدامات")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                    {filteredDonations.map((d) => (
                      <tr key={d.donation_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-3 py-2 font-mono font-medium text-gray-900 dark:text-gray-100">
                          {d.donation_number}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-800 dark:text-gray-200">{d.donor_number}</div>
                          <div className="text-gray-500 text-[11px]">
                            {d.donor_sex}, {d.age_years}y, {d.weight_kg}kg, Hb {d.hb_g_dl}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {d.abo && d.rh ? (
                            <span className="px-2 py-0.5 font-bold rounded bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                              {d.abo} {d.rh === "Positive" ? "+" : "-"}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">{t("Pending", "زیر التواء")}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div>{d.bag_type || "Standard"}</div>
                          <div className="text-gray-500 text-[11px]">
                            {d.volume_ml ? `${d.volume_ml} mL` : "-"} ({d.anticoagulant || "CPDA-1"})
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {d.reactive_markers && d.reactive_markers.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {d.reactive_markers.map((m) => (
                                <span
                                  key={m}
                                  className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-green-600 dark:text-green-400 text-[11px] font-medium">
                              {t("None Reported", "کوئی نہیں")}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                              d.status === "Cleared"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                                : d.status === "Reactive" || d.status === "Rejected"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                            }`}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => openDonationInspection(d.donation_id)}
                            className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 rounded"
                            data-help="blood_center_release.inspect_donation_btn"
                          >
                            {t("Inspect", "معائنہ")}
                          </button>
                          {canRelease && !isReadOnly && d.status === "Collected" && (
                            <button
                              onClick={() => openClearanceModal(d.donation_id)}
                              className="px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm"
                              data-help="blood_center_release.clearance_action_btn"
                            >
                              {t("Medical Clearance", "طبی منظوری")}
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

      {/* TAB 2: QUARANTINE RELEASE TO INVENTORY */}
      {activeTab === "quarantine" && (
        <div className="space-y-4">
          {/* Sub-bar: Filter components */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {t("Quarantine Filter:", "قرنطینہ فلٹر:")}
              </span>
              {(["Quarantine", "Released", "Discarded", "All"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setQuarantineFilter(st)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    quarantineFilter === st
                      ? "bg-blue-600 text-white dark:bg-blue-500"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                  data-help="blood_center_release.filter_quarantine"
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="text-xs text-gray-500">
              {t("Rule 1e77b26ed6: Dual-control co-signature required for release", "دوہرا تصدیقی دستخط لازمی ہے")}
            </div>
          </div>

          {/* Components Table */}
          <LoadState
            loading={componentsLoad.loading}
            error={componentsLoad.error}
            retry={componentsLoad.reload}
          />
          {!componentsLoad.loading && !componentsLoad.error && components.length === 0 && (
            <Empty>
              <span>
                {t(
                  "No blood components found for the selected quarantine filter.",
                  "منتخب کردہ فلٹر کے تحت کوئی اجزاء نہیں ملے۔"
                )}
              </span>
            </Empty>
          )}
          {!componentsLoad.loading && !componentsLoad.error && components.length > 0 && (
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold">
                    <tr>
                      <th className="px-3 py-2.5 text-left">{t("Component ID", "جز نمبر")}</th>
                      <th className="px-3 py-2.5 text-left">{t("Type", "قسم")}</th>
                      <th className="px-3 py-2.5 text-left">{t("Donation #", "عطیہ نمبر")}</th>
                      <th className="px-3 py-2.5 text-left">{t("Group", "گروپ")}</th>
                      <th className="px-3 py-2.5 text-left">{t("Volume", "حجم")}</th>
                      <th className="px-3 py-2.5 text-left">{t("Prepared / Expiry", "تیاری / میعاد")}</th>
                      <th className="px-3 py-2.5 text-left">{t("Status", "حالت")}</th>
                      <th className="px-3 py-2.5 text-left">{t("Blood Bank Unit", "بلڈ بینک یونٹ")}</th>
                      <th className="px-3 py-2.5 text-right">{t("Actions", "اقدامات")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                    {components.map((c) => (
                      <tr key={c.component_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-3 py-2 font-mono font-medium text-gray-900 dark:text-gray-100">
                          CMP-{c.component_id}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">
                          {c.component}
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-600 dark:text-gray-400">
                          {c.donation_number}
                        </td>
                        <td className="px-3 py-2">
                          {c.abo && c.rh ? (
                            <span className="px-2 py-0.5 font-bold rounded bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                              {c.abo} {c.rh === "Positive" ? "+" : "-"}
                            </span>
                          ) : (
                            <span className="text-amber-600 italic">{t("Uncleared", "غیر منظور شدہ")}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                          {c.volume_ml} mL
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-gray-800 dark:text-gray-200 text-[11px]">
                            {new Date(c.prepared_at).toLocaleDateString()}
                          </div>
                          <div
                            className={`text-[11px] font-medium ${
                              c.expired
                                ? "text-red-600 font-bold"
                                : "text-gray-500"
                            }`}
                          >
                            Exp: {new Date(c.expires_at).toLocaleDateString()} {c.expired && "(EXPIRED)"}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                              c.status === "Released"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                                : c.status === "Quarantine"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {c.unit_number ? (
                            <button
                              onClick={() => c.unit_id && handleTraceLookup(c.unit_id)}
                              className="text-blue-600 dark:text-blue-400 underline font-semibold"
                              data-help="blood_center_release.view_trace_unit_link"
                            >
                              {c.unit_number}
                            </button>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right space-x-1.5 whitespace-nowrap">
                          {canRelease && !isReadOnly && c.status === "Quarantine" && (
                            <button
                              onClick={() => openReleaseModal(c)}
                              disabled={c.donation_status !== "Cleared" || c.expired}
                              className={`px-2.5 py-1 text-xs font-medium rounded shadow-sm ${
                                c.donation_status === "Cleared" && !c.expired
                                  ? "bg-green-600 hover:bg-green-700 text-white"
                                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
                              }`}
                              data-help="blood_center_release.release_component_btn"
                              title={
                                c.donation_status !== "Cleared"
                                  ? "Donation must be Cleared before component can be released"
                                  : c.expired
                                  ? "Expired component cannot be released"
                                  : "Release to Blood Bank Inventory"
                              }
                            >
                              {t("Release to Bank", "بینک میں اخراج")}
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

      {/* TAB 3: BLOOD BANK UNIT TRACEABILITY */}
      {activeTab === "trace" && (
        <div className="space-y-4">
          {/* Lookup Input */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col sm:flex-row items-center gap-3">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
              {t("Lookup Blood Unit ID:", "بلڈ یونٹ تلاش کریں:")}
            </label>
            <input
              type="number"
              placeholder="e.g. 1, 2, 3..."
              value={traceUnitIdInput}
              onChange={(e) => setTraceUnitIdInput(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 w-full sm:w-48 font-mono"
              data-help="blood_center_release.trace_unit_id_input"
            />
            <button
              onClick={() => handleTraceLookup()}
              disabled={loadingTrace || !traceUnitIdInput.trim()}
              className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm disabled:opacity-50"
              data-help="blood_center_release.trace_lookup_btn"
            >
              {loadingTrace ? t("Tracing...", "تلاش جاری...") : t("Trace Unit", "یونٹ تلاش کریں")}
            </button>
          </div>

          {traceError && <ErrorBox error={traceError} />}

          {tracedUnit && (
            <div className="space-y-4">
              {/* Unit Card Header */}
              <div className="p-4 border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                      {t("Blood Bank Unit Provenance", "بلڈ بینک یونٹ تصدیق")}
                    </span>
                    <h2 className="text-xl font-bold font-mono text-gray-900 dark:text-gray-100">
                      {tracedUnit.unit_number}
                    </h2>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Source: {tracedUnit.source_name} (ID: {tracedUnit.source_id})
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-center px-3 py-1 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                      <div className="text-[10px] text-gray-500 uppercase">{t("Component", "جز")}</div>
                      <div className="font-bold text-gray-800 dark:text-gray-200">{tracedUnit.component}</div>
                    </div>
                    <div className="text-center px-3 py-1 bg-purple-100 dark:bg-purple-900/40 rounded border border-purple-200 dark:border-purple-800">
                      <div className="text-[10px] text-purple-600 uppercase">{t("Group", "گروپ")}</div>
                      <div className="font-bold text-purple-900 dark:text-purple-200">
                        {tracedUnit.abo} {tracedUnit.rh === "Positive" ? "+" : "-"}
                      </div>
                    </div>
                    <div className="text-center px-3 py-1 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                      <div className="text-[10px] text-gray-500 uppercase">{t("Status", "حالت")}</div>
                      <div className="font-bold text-gray-800 dark:text-gray-200">{tracedUnit.status}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-blue-200/60 dark:border-blue-900/40 text-xs">
                  <div>
                    <span className="text-gray-500">{t("Donation Number:", "عطیہ نمبر:")}</span>{" "}
                    <span className="font-mono font-medium text-gray-900 dark:text-gray-100">
                      {tracedUnit.donation_number || "External Source"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">{t("Volume:", "حجم:")}</span>{" "}
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {tracedUnit.volume_ml ? `${tracedUnit.volume_ml} mL` : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">{t("Expiry:", "میعاد:")}</span>{" "}
                    <span
                      className={`font-medium ${
                        tracedUnit.expired ? "text-red-600 font-bold" : "text-gray-900 dark:text-gray-100"
                      }`}
                    >
                      {new Date(tracedUnit.expires_at).toLocaleDateString()} {tracedUnit.expired && "(EXPIRED)"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">{t("Screened TTI:", "اسکریننگ:")}</span>{" "}
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {tracedUnit.screened ? t("Passed All 5 TTI", "مکمل پاس") : t("Pending", "زیر التواء")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Crossmatch & Issue History */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Crossmatch History */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase text-gray-700 dark:text-gray-300">
                    {t("Crossmatch Tests Performed", "کراس میچ ٹیسٹ")} ({tracedUnit.crossmatches.length})
                  </h3>
                  {tracedUnit.crossmatches.length === 0 ? (
                    <div className="text-xs text-gray-500 italic py-2">
                      {t("No crossmatch records for this unit yet.", "کوئی کراس میچ ریکارڈ نہیں ملا۔")}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tracedUnit.crossmatches.map((xm) => (
                        <div
                          key={xm.crossmatch_id}
                          className="p-2.5 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-xs"
                        >
                          <div className="flex justify-between font-medium">
                            <span>Req: {xm.request_number}</span>
                            <span
                              className={`font-bold ${
                                xm.result === "Compatible" ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {xm.result}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-500 mt-1">
                            Patient: {xm.patient_abo} {xm.patient_rh === "Positive" ? "+" : "-"} • Method: {xm.method}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Transfusion / Chain of Custody */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase text-gray-700 dark:text-gray-300">
                    {t("Transfusion & Bedside Admin History", "ٹرانسفیوژن اور نرسنگ ریکارڈ")} (
                    {tracedUnit.transfusions.length})
                  </h3>
                  {tracedUnit.transfusions.length === 0 ? (
                    <div className="text-xs text-gray-500 italic py-2">
                      {t("Unit has not been issued to any patient yet.", "ابھی تک کسی مریض کو جاری نہیں ہوا۔")}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tracedUnit.transfusions.map((tf) => (
                        <div
                          key={tf.transfusion_id}
                          className="p-2.5 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-xs"
                        >
                          <div className="flex justify-between font-medium">
                            <span>Patient: {tf.patient_name} (MRN: {tf.mrn})</span>
                            <span className="font-semibold text-blue-600">{tf.status}</span>
                          </div>
                          <div className="text-[11px] text-gray-500 mt-1 flex justify-between">
                            <span>Issued: {new Date(tf.issued_at).toLocaleString()}</span>
                            {tf.reaction && (
                              <span className="text-red-600 font-bold">Adverse Reaction Flagged</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: DONATION INSPECTION MODAL */}
      {inspectModalOpen && (
        <Modal
          title={t("Donation Lifetime Record & Laboratory Tests", "عطیہ مکمل ریکارڈ و لیب ٹیسٹ")}
          onClose={() => setInspectModalOpen(false)}
        >
          {loadingInspection || !selectedDonation ? (
            <div className="p-6 text-center text-xs text-gray-500">
              {t("Loading lifetime donation file...", "عطیہ کی تفصیلات لوڈ ہو رہی ہیں...")}
            </div>
          ) : (
            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-xs">
              {/* Header info */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <div>
                  <div className="font-bold font-mono text-sm text-gray-900 dark:text-gray-100">
                    {selectedDonation.donation_number}
                  </div>
                  <div className="text-gray-500">
                    Donor: {selectedDonation.donor_number} ({selectedDonation.donor_sex}, {selectedDonation.age_years}y,{" "}
                    {selectedDonation.weight_kg}kg, Hb {selectedDonation.hb_g_dl} g/dL)
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded text-xs font-bold ${
                    selectedDonation.status === "Cleared"
                      ? "bg-green-100 text-green-800"
                      : selectedDonation.status === "Reactive" || selectedDonation.status === "Rejected"
                      ? "bg-red-100 text-red-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {selectedDonation.status}
                </span>
              </div>

              {/* Recorded Laboratory Tests (rule:d1b6b7c78b) */}
              <div className="border border-gray-200 dark:border-gray-700 rounded p-3 space-y-2">
                <h4 className="font-bold uppercase text-gray-700 dark:text-gray-300">
                  {t("Recorded Laboratory Determinations & TTI Screens", "لیب ٹیسٹ و انفیکشن اسکریننگ")} (
                  {selectedDonation.tests.length})
                </h4>
                {selectedDonation.tests.length === 0 ? (
                  <div className="text-amber-600 italic">
                    {t("No laboratory tests recorded yet.", "ابھی تک کوئی لیب ٹیسٹ درج نہیں کیا گیا۔")}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-[11px]">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-2 py-1.5 text-left">{t("Marker", "مارکر")}</th>
                          <th className="px-2 py-1.5 text-left">{t("Sample", "سیمپل")}</th>
                          <th className="px-2 py-1.5 text-left">{t("Method", "طریقہ")}</th>
                          <th className="px-2 py-1.5 text-left">{t("Kit Lot", "لوٹ")}</th>
                          <th className="px-2 py-1.5 text-left">{t("Result", "نتیجہ")}</th>
                          <th className="px-2 py-1.5 text-left">{t("Tested By", "جانچ کنندہ")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {selectedDonation.tests.map((tt) => (
                          <tr key={tt.test_id}>
                            <td className="px-2 py-1.5 font-medium">{tt.marker}</td>
                            <td className="px-2 py-1.5">{tt.sample}</td>
                            <td className="px-2 py-1.5">{tt.method}</td>
                            <td className="px-2 py-1.5 font-mono">{tt.kit_lot || "-"}</td>
                            <td className="px-2 py-1.5 font-bold">
                              <span
                                className={
                                  tt.result === "Reactive"
                                    ? "text-red-600"
                                    : tt.result === "NonReactive" || tt.result === "Positive"
                                    ? "text-green-600"
                                    : "text-purple-600"
                                }
                              >
                                {tt.result}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-gray-500">{tt.tested_stamp?.name || tt.tested_by}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Prepared Components */}
              <div className="border border-gray-200 dark:border-gray-700 rounded p-3 space-y-2">
                <h4 className="font-bold uppercase text-gray-700 dark:text-gray-300">
                  {t("Prepared Components", "تیار کردہ اجزاء")} ({selectedDonation.components.length})
                </h4>
                {selectedDonation.components.length === 0 ? (
                  <div className="text-gray-500 italic">
                    {t("No components prepared from this donation yet.", "کوئی جز تیار نہیں ہوا۔")}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {selectedDonation.components.map((cp) => (
                      <div
                        key={cp.component_id}
                        className="p-2 bg-gray-50 dark:bg-gray-800 rounded flex justify-between items-center text-xs"
                      >
                        <div>
                          <span className="font-bold">{cp.component}</span> ({cp.volume_ml} mL)
                          <span className="ml-2 text-gray-500">Exp: {new Date(cp.expires_at).toLocaleDateString()}</span>
                        </div>
                        <span className="font-semibold text-blue-600">{cp.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* MODAL: DONATION CLEARANCE MODAL */}
      {clearanceModalOpen && (
        <Modal
          title={t("Punjab Blood Transfusion Authority — Donation Medical Clearance", "پی بی ٹی اے — عطیہ طبی منظوری")}
          onClose={() => setClearanceModalOpen(false)}
        >
          {targetDonation && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded border border-blue-200 dark:border-blue-800">
                <div className="font-mono font-bold text-gray-900 dark:text-gray-100">
                  {targetDonation.donation_number}
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  Donor: {targetDonation.donor_number} • Volume: {targetDonation.volume_ml} mL ({targetDonation.bag_type || "Single"})
                </div>
              </div>

              {/* Validation Feedback banner */}
              {clearanceValidationMsg && (
                <div
                  className={`p-2.5 rounded text-xs font-medium ${
                    clearanceOutcome === "Reactive" || clearanceOutcome === "Rejected"
                      ? "bg-red-50 text-red-800 border border-red-200"
                      : "bg-amber-50 text-amber-800 border border-amber-200"
                  }`}
                >
                  {clearanceValidationMsg}
                </div>
              )}

              {/* Outcome Selection (rule:d1b6b7c78b) */}
              <Field
                label={t("Clearance Outcome", "منظوری کا فیصلہ")}
                hint={t(
                  "Cleared: all 5 TTI screens non-reactive and dual determinations agree. Reactive: any confirmed reactive marker. Rejected: discrepancy or post-donation exclusion.",
                  "منظور شدہ، مثبت (رد)، یا مسترد۔"
                )}
              >
                <div className="flex gap-3">
                  {(["Cleared", "Reactive", "Rejected"] as const).map((outc) => (
                    <label
                      key={outc}
                      className={`flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer flex-1 ${
                        clearanceOutcome === outc
                          ? "border-blue-600 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 font-bold"
                          : "border-gray-300 dark:border-gray-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="clearanceOutcome"
                        value={outc}
                        checked={clearanceOutcome === outc}
                        onChange={() => setClearanceOutcome(outc)}
                        data-help="blood_center_release.radio_clearance_outcome"
                      />
                      <span>{outc}</span>
                    </label>
                  ))}
                </div>
              </Field>

              {/* Clearance Note */}
              <Field
                label={t("Medical Clearance Note", "میڈیکل نوٹ")}
                hint={t(
                  "Mandatory when outcome is Rejected. Required for anomalous grouping or post-donation disclosures.",
                  "مسترد کرنے کی صورت میں تفصیلی وجہ لکھنا لازمی ہے۔"
                )}
              >
                <textarea
                  value={clearanceNote}
                  onChange={(e) => setClearanceNote(e.target.value)}
                  placeholder="Document clinical verification reasoning..."
                  rows={3}
                  className="w-full px-3 py-2 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  data-help="blood_center_release.clearance_note_textarea"
                />
              </Field>

              <ClinicalWriteFeedback write={write} />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setClearanceModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                  data-help="blood_center_release.btn_cancel_clearance"
                >
                  {t("Cancel", "منسوخ")}
                </button>
                <button
                  type="button"
                  onClick={handleClearanceSubmit}
                  disabled={write.busy}
                  className={`px-4 py-1.5 text-xs font-bold rounded shadow-sm text-white ${
                    clearanceOutcome === "Cleared"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                  data-help="blood_center_release.submit_clearance_btn"
                >
                  {write.busy
                    ? t("Submitting...", "جمع ہو رہا ہے...")
                    : t(`Sign Clearance (${clearanceOutcome})`, `فیصلہ محفوظ کریں (${clearanceOutcome})`)}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* MODAL: DUAL-CONTROL QUARANTINE RELEASE MODAL (rule:1e77b26ed6) */}
      {releaseModalOpen && (
        <Modal
          title={t("Dual-Control Quarantine Release to Blood Bank Inventory", "بلڈ بینک انوینٹری کے لیے دوہرا تصدیقی اخراج")}
          onClose={() => setReleaseModalOpen(false)}
        >
          {targetComponent && (
            <div className="space-y-4 text-xs">
              {/* Success state */}
              {releaseSuccessResult ? (
                <div className="p-4 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg space-y-3">
                  <div className="font-bold text-green-900 dark:text-green-200 text-sm">
                    {t("Component Successfully Released to Blood Bank Inventory!", "جز کامیابی کے ساتھ بلڈ بینک میں شامل ہو گیا!")}
                  </div>
                  <div className="text-xs text-green-800 dark:text-green-300">
                    {t("Created Blood Bank Unit:", "نیا بلڈ بینک یونٹ:")}{" "}
                    <span className="font-mono font-bold text-sm">{releaseSuccessResult.unit_number}</span> (ID:{" "}
                    {releaseSuccessResult.unit_id})
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => {
                        setReleaseModalOpen(false);
                        if (releaseSuccessResult.unit_id) {
                          handleTraceLookup(releaseSuccessResult.unit_id);
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-bold bg-green-600 text-white rounded hover:bg-green-700"
                      data-help="blood_center_release.view_traced_unit_btn"
                    >
                      {t("View in Unit Traceability Tab", "ٹریس ایبلٹی ٹیب میں دیکھیں")}
                    </button>
                    <button
                      onClick={() => setReleaseModalOpen(false)}
                      className="px-3 py-1.5 text-xs bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                      data-help="blood_center_release.btn_close_release_success"
                    >
                      {t("Close", "بند کریں")}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Step 1: Label Preview and Print Verification */}
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold uppercase text-gray-700 dark:text-gray-300">
                        {t("Step 1: Check Component Label & Print", "مرحلہ ۱: لیبل کی تصدیق و پرنٹ")}
                      </span>
                      <button
                        type="button"
                        onClick={handlePrintLabel}
                        className="px-2.5 py-1 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm"
                        data-help="blood_center_release.print_component_label_btn"
                      >
                        {labelPrinted ? t("✓ Label Printed", "✓ لیبل پرنٹ ہو گیا") : t("Print Label", "لیبل پرنٹ کریں")}
                      </button>
                    </div>

                    {loadingLabel ? (
                      <div className="text-gray-500 italic py-2">{t("Loading label preview...", "لوڈ ہو رہا ہے...")}</div>
                    ) : componentLabelData ? (
                      <div className="p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded font-mono text-[11px] space-y-1">
                        <div className="flex justify-between font-bold">
                          <span>{componentLabelData.fields.component_name}</span>
                          <span>
                            {componentLabelData.fields.abo} {componentLabelData.fields.rh === "Positive" ? "+" : "-"}
                          </span>
                        </div>
                        <div className="text-gray-500">
                          Vol: {componentLabelData.fields.volume_ml} mL • Storage: {componentLabelData.fields.storage}
                        </div>
                        <div className="text-gray-500">
                          Exp: {new Date(componentLabelData.fields.expires_at).toLocaleString()}
                        </div>
                        {componentLabelData.fields.caution && componentLabelData.fields.caution.length > 0 && (
                          <div className="text-[10px] text-amber-700 dark:text-amber-300 pt-1 border-t border-gray-200 dark:border-gray-800">
                            CAUTION: {componentLabelData.fields.caution.join(" | ")}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {/* Step 2: Dual Control Co-signature (rule:1e77b26ed6) */}
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded border border-amber-200 dark:border-amber-800 space-y-3">
                    <div className="font-bold uppercase text-amber-900 dark:text-amber-200">
                      {t(
                        "Step 2: Second Verifier Co-Signature (Dual Control)",
                        "مرحلہ ۲: دوسرے تصدیق کنندہ کے دستخط (دوہرا کنٹرول)"
                      )}
                    </div>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300">
                      {t(
                        "PBTA labelling SOP: The second person who checked the number and the label signs with their own credentials. Must be a different authorized staff member holding blood_center.process or blood_center.release.",
                        "دوسرے شخص کا اپنا یوزرنیم اور پاس ورڈ درج کرنا لازمی ہے۔ یہ لاگ ان شدہ صارف سے مختلف ہونا چاہیے۔"
                      )}
                    </p>

                    <Field label={t("Checker (Second Person) Username", "دوسرے تصدیق کنندہ کا یوزرنیم")}>
                      <input
                        type="text"
                        autoComplete="off"
                        placeholder="Username of 2nd verifier (e.g. demo.labadmin)"
                        value={checkerUsername}
                        onChange={(e) => setCheckerUsername(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 font-mono"
                        data-help="blood_center_release.checker_username_input"
                      />
                    </Field>

                    <Field label={t("Checker Password", "پاس ورڈ")}>
                      <input
                        type="password"
                        autoComplete="new-password"
                        placeholder="Enter password..."
                        value={checkerPassword}
                        onChange={(e) => setCheckerPassword(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                        data-help="blood_center_release.checker_password_input"
                      />
                    </Field>
                  </div>

                  {dualControlError && <ErrorBox error={dualControlError} />}

                  <ClinicalWriteFeedback write={write} />

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setReleaseModalOpen(false)}
                      className="px-3 py-1.5 text-xs text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                      data-help="blood_center_release.btn_cancel_release"
                    >
                      {t("Cancel", "منسوخ")}
                    </button>
                    <button
                      type="button"
                      onClick={handleReleaseSubmit}
                      disabled={
                        write.busy ||
                        !checkerUsername.trim() ||
                        !checkerPassword.trim()
                      }
                      className="px-4 py-1.5 text-xs font-bold rounded shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                      data-help="blood_center_release.confirm_release_btn"
                    >
                      {write.busy
                        ? t("Releasing...", "اخراج ہو رہا ہے...")
                        : t("Co-Sign & Release to Inventory", "تصدیق و انوینٹری اخراج")}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
