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
  BloodRequestOut,
  BloodTransfusionDetailOut,
  BloodTransfusionOut,
  ObservationIn,
  StartIn,
  EndIn,
  ReactionIn,
  ReturnIn,
  IdentityVerifyOut,
} from "../generated/transfusion_bedside";
import {
  worklistBloodRequests,
  getRequest,
  getTransfusion,
  observe,
  startBloodTransfusions,
  end,
  reaction,
  returnUnit,
  verifyWristband,
} from "../generated/transfusion_bedside";
import {
  getTransfusionBedsideScreenView,
  isBloodTransfusionActiveOrRetiring,
  getStartByRemainingSeconds,
  formatCountdown,
  isUnitOutTooLong,
  isTransfusionLate,
  validateBedsideChecks,
  validateSecondChecker,
  validateObservationInput,
  validateReactionInput,
  explainTransfusionError,
} from "../transfusion-bedside-policy";
import { useClinicalWrite, ClinicalWriteFeedback } from "../clinical-write";

export function TransfusionBedside({
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
  const view = getTransfusionBedsideScreenView(establishment);
  const activeOrRetiring = isBloodTransfusionActiveOrRetiring(establishment);
  const canView = user.permissions?.includes("blood.view") ?? false;
  const canTransfuse = user.permissions?.includes("blood.transfuse") ?? false;

  const [activeTab, setActiveTab] = useState<"worklist" | "detail">("worklist");
  const [statusFilter, setStatusFilter] = useState<"Issued" | "InProgress" | "Completed" | "All">("Issued");
  const [searchQuery, setSearchQuery] = useState("");
  const [revision, setRevision] = useState(0);

  // Real-time alerts
  const [issuedAlert, setIssuedAlert] = useState<string | null>(null);
  const [consentWithdrawnAlert, setConsentWithdrawnAlert] = useState<string | null>(null);

  // Selected Transfusion for detail inspection
  const [selectedTransfusionId, setSelectedTransfusionId] = useState<number | null>(null);
  const [selectedTransfusionDetail, setSelectedTransfusionDetail] = useState<BloodTransfusionDetailOut | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Start Modal State (rule:0a07d57ff8)
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [targetForStart, setTargetForStart] = useState<BloodTransfusionOut | null>(null);
  const [wristbandCode, setWristbandCode] = useState("");
  const [verifyingWristband, setVerifyingWristband] = useState(false);
  const [wristbandResult, setWristbandResult] = useState<IdentityVerifyOut | null>(null);
  const [wristbandError, setWristbandError] = useState<string | null>(null);
  const [identityCheckMethod, setIdentityCheckMethod] = useState<"WristbandScan" | "TwoIdentifiers" | "EmergencyOverride">("WristbandScan");
  const [identityNote, setIdentityNote] = useState("");

  // 5 Mandatory Bedside Checkboxes
  const [checkIdentity, setCheckIdentity] = useState(false);
  const [checkUnitNumber, setCheckUnitNumber] = useState(false);
  const [checkExpiry, setCheckExpiry] = useState(false);
  const [checkProduct, setCheckProduct] = useState(false);
  const [checkBag, setCheckBag] = useState(false);

  // Dual Control Co-signature
  const [secondCheckerUsername, setSecondCheckerUsername] = useState("");
  const [secondCheckerPassword, setSecondCheckerPassword] = useState("");
  const [startValidationError, setStartValidationError] = useState<string | null>(null);

  // Observation Modal State (rule:efcdf1e299)
  const [obsModalOpen, setObsModalOpen] = useState(false);
  const [targetForObs, setTargetForObs] = useState<BloodTransfusionOut | null>(null);
  const [obsTime, setObsTime] = useState("");
  const [obsTemp, setObsTemp] = useState("");
  const [obsPulse, setObsPulse] = useState("");
  const [obsSystolic, setObsSystolic] = useState("");
  const [obsDiastolic, setObsDiastolic] = useState("");
  const [obsResp, setObsResp] = useState("");
  const [obsNote, setObsNote] = useState("");
  const [obsError, setObsError] = useState<string | null>(null);

  // End Modal State (rule:efcdf1e299)
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [targetForEnd, setTargetForEnd] = useState<BloodTransfusionOut | null>(null);
  const [endOutcome, setEndOutcome] = useState<"Completed" | "Stopped">("Completed");
  const [endVolume, setEndVolume] = useState("");
  const [endNote, setEndNote] = useState("");
  const [endError, setEndError] = useState<string | null>(null);

  // Reaction Modal State (rule:a2f80c80d7)
  const [reactionModalOpen, setReactionModalOpen] = useState(false);
  const [targetForReaction, setTargetForReaction] = useState<BloodTransfusionOut | null>(null);
  const [rxTime, setRxTime] = useState("");
  const [rxType, setRxType] = useState("");
  const [rxSigns, setRxSigns] = useState("");
  const [rxAction, setRxAction] = useState("");
  const [rxReason, setRxReason] = useState("");
  const [rxClass, setRxClass] = useState<"Haemolytic" | "Anaphylactic" | "DelayedHaemolytic" | "Bacterial" | "Other">("Haemolytic");
  const [rxFatal, setRxFatal] = useState(false);
  const [rxDelayedAfter, setRxDelayedAfter] = useState("");
  const [rxAntibody, setRxAntibody] = useState("");
  const [rxOrganism, setRxOrganism] = useState("");
  const [rxWrongBlood, setRxWrongBlood] = useState(false);
  const [rxHarm, setRxHarm] = useState<"NoHarm" | "Mild" | "Moderate" | "Severe" | "Death">("Moderate");
  const [rxError, setRxError] = useState<string | null>(null);

  // Return / Not Given Modal State (rule:8e16f20b4a)
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [targetForReturn, setTargetForReturn] = useState<BloodTransfusionOut | null>(null);
  const [returnFitForUse, setReturnFitForUse] = useState(true);
  const [returnDiscardReason, setReturnDiscardReason] = useState<"Expired" | "BagDamaged" | "OutOfStorageTooLong" | "StorageTemperature" | "IdentityDiscrepancy" | "Other">("OutOfStorageTooLong");
  const [returnNote, setReturnNote] = useState("");
  const [returnError, setReturnError] = useState<string | null>(null);

  // Clinical write controller
  const write = useClinicalWrite(user, "transfusion_bedside", (value: any, cmd) => {
    setRevision((r) => r + 1);
    if (cmd.path.includes("/start")) {
      setStartModalOpen(false);
      setTargetForStart(null);
    } else if (cmd.path.includes("/observations")) {
      setObsModalOpen(false);
      setTargetForObs(null);
    } else if (cmd.path.includes("/end")) {
      setEndModalOpen(false);
      setTargetForEnd(null);
    } else if (cmd.path.includes("/reaction")) {
      setReactionModalOpen(false);
      setTargetForReaction(null);
    } else if (cmd.path.includes("/return")) {
      setReturnModalOpen(false);
      setTargetForReturn(null);
    }
    if (selectedTransfusionId) {
      loadTransfusionDetail(selectedTransfusionId);
    }
  });

  // Real-time Event Subscription (blood.unit.issued, blood.consent.withdrawn)
  useEffect(() => {
    if (!stream) return;
    try {
      const parsed = JSON.parse(stream);
      const ev = parsed.event || parsed.topic;
      if (ev === "blood.unit.issued") {
        setIssuedAlert(`New blood unit issued for patient ${parsed.patient_name || parsed.mrn || ""}. 30-minute start window begun.`);
        setRevision((r) => r + 1);
      } else if (ev === "blood.consent.withdrawn") {
        setConsentWithdrawnAlert(`CRITICAL: Transfusion consent withdrawn for patient (MRN: ${parsed.mrn || "Unknown"})! Any unstarted units must not be given; running transfusions must be stopped immediately.`);
        setRevision((r) => r + 1);
      }
    } catch {
      // Non-json stream line
    }
  }, [stream]);

  // Load blood requests and their active transfusions
  const requestsLoad = useLoad(
    async () => {
      if (!canView) return [];
      const reqs = await worklistBloodRequests({ limit: 100 });
      return reqs;
    },
    [canView, revision]
  );

  const requests = (requestsLoad.data as BloodRequestOut[] | undefined) || [];

  // Extract all transfusions across requests
  // To get full transfusion details, we also fetch detail when a user inspects
  const [transfusionsList, setTransfusionsList] = useState<BloodTransfusionOut[]>([]);
  const [loadingTransfusions, setLoadingTransfusions] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchTransfusions = async () => {
      if (!canView || requests.length === 0) {
        setTransfusionsList([]);
        return;
      }
      setLoadingTransfusions(true);
      try {
        const detailPromises = requests.slice(0, 30).map((r) =>
          getRequest(r.request_id)
            .then((res) => res.transfusions || [])
            .catch(() => [])
        );
        const results = await Promise.all(detailPromises);
        if (active) {
          const flat = results.flat() as BloodTransfusionOut[];
          setTransfusionsList(flat);
        }
      } catch (err) {
        console.error("Failed to load request transfusions:", err);
      } finally {
        if (active) setLoadingTransfusions(false);
      }
    };
    fetchTransfusions();
    return () => {
      active = false;
    };
  }, [canView, requests, revision]);

  // Load selected transfusion detail
  const loadTransfusionDetail = async (id: number) => {
    setLoadingDetail(true);
    setSelectedTransfusionId(id);
    try {
      const detail = await getTransfusion(id);
      setSelectedTransfusionDetail(detail);
      setActiveTab("detail");
    } catch (err) {
      console.error("Failed to load transfusion detail:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Open Start Modal
  const openStartModal = (tx: BloodTransfusionOut) => {
    setTargetForStart(tx);
    setWristbandCode("");
    setWristbandResult(null);
    setWristbandError(null);
    setIdentityCheckMethod("WristbandScan");
    setIdentityNote("");
    setCheckIdentity(false);
    setCheckUnitNumber(false);
    setCheckExpiry(false);
    setCheckProduct(false);
    setCheckBag(false);
    setSecondCheckerUsername("");
    setSecondCheckerPassword("");
    setStartValidationError(null);
    setStartModalOpen(true);
  };

  // Scan & Verify Wristband
  const handleVerifyWristband = async () => {
    if (!targetForStart || !wristbandCode.trim()) return;
    setVerifyingWristband(true);
    setWristbandError(null);
    try {
      const res = await verifyWristband({
        code: wristbandCode.trim(),
        patient_id: targetForStart.patient_id,
      });
      setWristbandResult(res);
      if (!res.match) {
        setWristbandError(`Identity Discrepancy: Scanned MRN (${res.scanned_mrn}) does not match expected patient MRN (${res.expected_patient.mrn})!`);
      } else {
        setCheckIdentity(true);
      }
    } catch (err: any) {
      setWristbandError(err.message || "Failed to verify wristband code.");
    } finally {
      setVerifyingWristband(false);
    }
  };

  // Submit Start
  const handleStartSubmit = () => {
    if (!targetForStart) return;

    // Check 30-min window
    if (isUnitOutTooLong(targetForStart.start_by)) {
      setStartValidationError("Cold chain threshold exceeded: Unit has been out > 30 minutes (BLOOD_UNIT_OUT_TOO_LONG). You must record unit as Not Given.");
      return;
    }

    // Validate 5 checks
    const checks = {
      identity: checkIdentity,
      unit_number: checkUnitNumber,
      expiry: checkExpiry,
      product: checkProduct,
      bag: checkBag,
    };
    const checkVal = validateBedsideChecks(checks);
    if (!checkVal.valid) {
      setStartValidationError(`All 5 safety checks must be verified: Missing ${checkVal.failedItems.join("; ")}.`);
      return;
    }

    // Validate second checker credentials
    const checkerVal = validateSecondChecker(secondCheckerUsername, secondCheckerPassword, user.username);
    if (!checkerVal.valid) {
      setStartValidationError(checkerVal.error || "Invalid second checker credentials");
      return;
    }

    const payload: StartIn = {
      wristband_code: identityCheckMethod === "WristbandScan" ? wristbandCode.trim() : null,
      identity_check: identityCheckMethod,
      identity_note: identityCheckMethod !== "WristbandScan" ? identityNote.trim() : null,
      checks,
      second_checker_username: secondCheckerUsername.trim(),
      second_checker_password: secondCheckerPassword.trim(),
    };

    write.start({
      method: "POST",
      path: `/blood/transfusions/${targetForStart.transfusion_id}/start`,
      body: payload,
      permission: "blood.transfuse",
      protection: "idempotent",
      label: t("Start Transfusion", "ٹرانسفیوژن شروع کریں"),
    });
  };

  // Open Observation Modal
  const openObsModal = (tx: BloodTransfusionOut) => {
    setTargetForObs(tx);
    setObsTime(new Date().toISOString().slice(0, 16));
    setObsTemp("");
    setObsPulse("");
    setObsSystolic("");
    setObsDiastolic("");
    setObsResp("");
    setObsNote("");
    setObsError(null);
    setObsModalOpen(true);
  };

  // Submit Observation
  const handleObsSubmit = () => {
    if (!targetForObs) return;

    const payload: ObservationIn = {
      observed_at: new Date(obsTime).toISOString(),
      temperature_c: obsTemp ? Number(obsTemp) : null,
      pulse: obsPulse ? Number(obsPulse) : null,
      bp_systolic: obsSystolic ? Number(obsSystolic) : null,
      bp_diastolic: obsDiastolic ? Number(obsDiastolic) : null,
      respiratory_rate: obsResp ? Number(obsResp) : null,
      note: obsNote.trim() ? obsNote.trim() : null,
    };

    const val = validateObservationInput(payload);
    if (!val.valid) {
      setObsError(val.error || "Invalid observation values");
      return;
    }

    write.start({
      method: "POST",
      path: `/blood/transfusions/${targetForObs.transfusion_id}/observations`,
      body: payload,
      permission: "blood.transfuse",
      protection: "idempotent",
      label: t("Record Vitals", "وائٹلز درج کریں"),
    });
  };

  // Open End Modal
  const openEndModal = (tx: BloodTransfusionOut) => {
    setTargetForEnd(tx);
    setEndOutcome("Completed");
    setEndVolume(tx.component === "Platelets" ? "50" : "250");
    setEndNote("");
    setEndError(null);
    setEndModalOpen(true);
  };

  // Submit End
  const handleEndSubmit = () => {
    if (!targetForEnd) return;
    if (endOutcome === "Stopped" && !endNote.trim()) {
      setEndError("Clinical explanation note is mandatory when stopping a transfusion.");
      return;
    }

    const payload: EndIn = {
      outcome: endOutcome,
      volume_given_ml: endVolume ? Number(endVolume) : null,
      end_note: endNote.trim() ? endNote.trim() : null,
    };

    write.start({
      method: "POST",
      path: `/blood/transfusions/${targetForEnd.transfusion_id}/end`,
      body: payload,
      permission: "blood.transfuse",
      protection: "idempotent",
      label: t("End Transfusion", "ٹرانسفیوژن ختم کریں"),
    });
  };

  // Open Reaction Modal
  const openReactionModal = (tx: BloodTransfusionOut) => {
    setTargetForReaction(tx);
    setRxTime(new Date().toISOString().slice(0, 16));
    setRxType("");
    setRxSigns("");
    setRxAction("");
    setRxReason("");
    setRxClass("Haemolytic");
    setRxFatal(false);
    setRxDelayedAfter("");
    setRxAntibody("");
    setRxOrganism("");
    setRxWrongBlood(false);
    setRxHarm("Moderate");
    setRxError(null);
    setReactionModalOpen(true);
  };

  // Submit Reaction
  const handleReactionSubmit = () => {
    if (!targetForReaction) return;

    const payload: ReactionIn = {
      noticed_at: new Date(rxTime).toISOString(),
      reaction_type: rxType.trim(),
      signs: rxSigns.trim(),
      action_taken: rxAction.trim(),
      possible_reason: rxReason.trim() ? rxReason.trim() : null,
      reaction_class: rxClass,
      fatal: rxFatal,
      delayed_after: rxClass === "DelayedHaemolytic" ? rxDelayedAfter.trim() : null,
      antibody: rxClass === "DelayedHaemolytic" ? rxAntibody.trim() : null,
      organism: rxClass === "Bacterial" ? rxOrganism.trim() : null,
      wrong_blood: rxWrongBlood,
      harm: rxFatal ? "Death" : rxHarm,
    };

    const val = validateReactionInput(payload);
    if (!val.valid) {
      setRxError(val.error || "Invalid reaction form input");
      return;
    }

    write.start({
      method: "POST",
      path: `/blood/transfusions/${targetForReaction.transfusion_id}/reaction`,
      body: payload,
      permission: "blood.transfuse",
      protection: "idempotent",
      label: t("Report Reaction", "ری ایکشن رپورٹ درج کریں"),
    });
  };

  // Open Return Modal
  const openReturnModal = (tx: BloodTransfusionOut) => {
    setTargetForReturn(tx);
    const expired = isUnitOutTooLong(tx.start_by);
    setReturnFitForUse(!expired);
    setReturnDiscardReason(expired ? "OutOfStorageTooLong" : "IdentityDiscrepancy");
    setReturnNote(expired ? "Exceeded 30-minute out-of-refrigerator threshold" : "");
    setReturnError(null);
    setReturnModalOpen(true);
  };

  // Submit Return
  const handleReturnSubmit = () => {
    if (!targetForReturn) return;
    if (!returnFitForUse && !returnNote.trim()) {
      setReturnError("Explanation note is required when signing back a unit that is not fit for use.");
      return;
    }

    const payload: ReturnIn = {
      fit_for_use: returnFitForUse,
      discard_reason: !returnFitForUse ? returnDiscardReason : null,
      note: returnNote.trim() ? returnNote.trim() : null,
    };

    write.start({
      method: "POST",
      path: `/blood/transfusions/${targetForReturn.transfusion_id}/return`,
      body: payload,
      permission: "blood.transfuse",
      protection: "idempotent",
      label: t("Return Unit", "یونٹ واپس / نا دینے کا اندراج"),
    });
  };

  if (!canView) {
    return (
      <div className="p-6">
        <ErrorBox
          error={t(
            "Access Denied: You do not hold 'blood.view' permission required to view bedside transfusion administration.",
            "رسائی مسترد: آپ کے پاس بیڈ سائیڈ ٹرانسفیوژن دیکھنے کی اجازت نہیں ہے۔"
          )}
        />
      </div>
    );
  }

  const isReadOnly = view === "records";
  const isRetiring = view === "open_work";

  const filteredTransfusions = transfusionsList.filter((tx) => {
    if (statusFilter !== "All" && tx.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      tx.unit_number.toLowerCase().includes(q) ||
      tx.mrn.toLowerCase().includes(q) ||
      tx.patient_name.toLowerCase().includes(q) ||
      tx.request_number.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {t("Transfusion Bedside Verification & Administration", "بیڈ سائیڈ ٹرانسفیوژن تصدیق و نرسنگ")}
            </h1>
            <span
              className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                activeOrRetiring
                  ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              }`}
            >
              {establishment.profile?.label || "Blood Transfusion"}
            </span>
            <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded font-mono">
              Position 81
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t(
              "Punjab Blood Transfusion Safety Act 2016 s.13, 30-minute cold chain start countdown, dual-control co-signature, and adverse reaction management.",
              "پنجاب بلڈ ٹرانسفیوژن سیفٹی ایکٹ، ۳۰ منٹ کولڈ چین الٹی گنتی، دوہرا تصدیقی کنٹرول، اور ری ایکشن رپورٹنگ۔"
            )}
          </p>
        </div>

        {/* Global Action / Refresh */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRevision((r) => r + 1)}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
            data-help="transfusion_bedside.refresh"
          >
            {t("Refresh", "تازہ کریں")}
          </button>
        </div>
      </div>

      {/* Retiring Notice (rule:d97564a224, rule:877e58cf09) */}
      {isRetiring && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-lg text-amber-800 dark:text-amber-200 text-sm flex items-center justify-between">
          <span>
            {t(
              "No new blood transfusions from now on (Blood Transfusion service is Retiring). Existing open requests and issued units continue.",
              "اب سے کوئی نیا ٹرانسفیوژن نہیں کیا جا سکتا (بلڈ ٹرانسفیوژن سروس ریٹائر ہو رہی ہے)۔ پہلے سے موجود درخواستیں اور جاری شدہ بیگز مکمل کیے جا سکتے ہیں۔"
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
            "Service is Closed: View-only mode for audit history and transfusion reaction records.",
            "سروس بند ہے: آڈٹ ریکارڈ اور ری ایکشن ہسٹری کے لیے صرف دیکھنے کی اجازت ہے۔"
          )}
        </div>
      )}

      {/* Real-time Event Alerts */}
      {consentWithdrawnAlert && (
        <div className="p-4 bg-red-100 dark:bg-red-950/60 border-2 border-red-600 dark:border-red-500 rounded-lg text-red-900 dark:text-red-100 text-sm flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base">⚠️ {t("CRITICAL SAFETY ALERT:", "انتہائی اہم طبی انتباہ:")}</span>
            <span>{consentWithdrawnAlert}</span>
          </div>
          <button
            onClick={() => setConsentWithdrawnAlert(null)}
            className="text-xs font-bold underline text-red-800 dark:text-red-200 ml-4 whitespace-nowrap"
            data-help="transfusion_bedside.btn_dismiss_critical_alert"
          >
            {t("Acknowledge", "تصدیق کی")}
          </button>
        </div>
      )}

      {issuedAlert && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-700 rounded-md text-blue-800 dark:text-blue-200 text-sm flex items-center justify-between">
          <span>{issuedAlert}</span>
          <button
            onClick={() => setIssuedAlert(null)}
            className="text-xs font-semibold underline text-blue-700 dark:text-blue-300"
            data-help="transfusion_bedside.btn_dismiss_issued_alert"
          >
            {t("Dismiss", "رد کریں")}
          </button>
        </div>
      )}

      {/* Main Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 space-x-4">
        <button
          onClick={() => setActiveTab("worklist")}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "worklist"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-semibold"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
          data-help="transfusion_bedside.tab_worklist"
        >
          {t("Bedside Transfusion Worklist", "بیڈ سائیڈ ٹرانسفیوژن لسٹ")}
          {transfusionsList.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              {transfusionsList.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("detail")}
          disabled={!selectedTransfusionDetail}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "detail"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-semibold"
              : selectedTransfusionDetail
              ? "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
              : "border-transparent text-gray-300 dark:text-gray-600 cursor-not-allowed"
          }`}
          data-help="transfusion_bedside.tab_detail"
        >
          {t("Transfusion Detail & Observations", "ٹرانسفیوژن مکمل تفصیل و وائٹلز")}
          {selectedTransfusionDetail && (
            <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-mono">
              {selectedTransfusionDetail.unit_number}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: BEDSIDE WORKLIST */}
      {activeTab === "worklist" && (
        <div className="space-y-4">
          {/* Sub-bar: Status Filter + Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {t("Status Filter:", "اسٹیٹس فلٹر:")}
              </span>
              {(["Issued", "InProgress", "Completed", "All"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    statusFilter === st
                      ? "bg-blue-600 text-white dark:bg-blue-500"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                  data-help="transfusion_bedside.filter_status"
                >
                  {st === "Issued"
                    ? t("Issued (Pending Start)", "جاری شدہ (آغاز کے منتظر)")
                    : st === "InProgress"
                    ? t("In Progress (Transfusing)", "جاری ہے (لگایا جا رہا ہے)")
                    : st}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder={t("Search MRN, patient, unit #...", "تلاش کریں...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono"
                data-help="transfusion_bedside.search_input"
              />
            </div>
          </div>

          <LoadState
            loading={requestsLoad.loading || loadingTransfusions}
            error={requestsLoad.error}
            retry={requestsLoad.reload}
          />

          {!requestsLoad.loading && !loadingTransfusions && filteredTransfusions.length === 0 && (
            <Empty>
              <span>
                {t(
                  "No blood transfusions match the selected filter. Newly issued units from the blood bank will appear here.",
                  "منتخب کردہ فلٹر کے تحت کوئی ٹرانسفیوژن ریکارڈ نہیں ملا۔"
                )}
              </span>
            </Empty>
          )}

          {!requestsLoad.loading && !loadingTransfusions && filteredTransfusions.length > 0 && (
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold">
                  <tr>
                    <th className="px-3 py-2.5 text-left">{t("Unit # / Bag", "یونٹ نمبر")}</th>
                    <th className="px-3 py-2.5 text-left">{t("Patient Info", "مریض کا ریکارڈ")}</th>
                    <th className="px-3 py-2.5 text-left">{t("Group", "گروپ")}</th>
                    <th className="px-3 py-2.5 text-left">{t("Component", "جز")}</th>
                    <th className="px-3 py-2.5 text-left">{t("30-Min Start Countdown", "۳۰ منٹ الٹی گنتی")}</th>
                    <th className="px-3 py-2.5 text-left">{t("Status", "حالت")}</th>
                    <th className="px-3 py-2.5 text-right">{t("Actions", "اقدامات")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                  {filteredTransfusions.map((tx) => {
                    const remainingSec = getStartByRemainingSeconds(tx.start_by);
                    const expired = remainingSec <= 0;
                    const late = tx.ended_late;

                    return (
                      <tr key={tx.transfusion_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-3 py-2 font-mono font-bold text-gray-900 dark:text-gray-100">
                          {tx.unit_number}
                          {tx.reaction && (
                            <div className="mt-0.5">
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                                REACTION REPORTED
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{tx.patient_name}</div>
                          <div className="text-gray-500 text-[11px] font-mono">MRN: {tx.mrn}</div>
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 font-bold rounded bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                            {tx.abo} {tx.rh === "Positive" ? "+" : "-"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                          {tx.component}
                        </td>
                        <td className="px-3 py-2">
                          {tx.status === "Issued" ? (
                            <div
                              className={`font-mono font-bold text-xs ${
                                expired
                                  ? "text-red-600 animate-pulse"
                                  : remainingSec < 600
                                  ? "text-amber-600"
                                  : "text-green-600"
                              }`}
                            >
                              ⏱ {formatCountdown(remainingSec)}
                              <div className="text-[10px] font-normal text-gray-500">
                                {t("Limit: 30m from issue", "حد: ۳۰ منٹ")}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                              tx.status === "InProgress"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-bold"
                                : tx.status === "Completed"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                                : tx.status === "Stopped" || tx.status === "NotGiven"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                            }`}
                          >
                            {tx.status}
                          </span>
                          {late && (
                            <span className="ml-1 px-1.5 py-0.2 text-[10px] font-medium rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                              Ended Late (&gt;4h)
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => loadTransfusionDetail(tx.transfusion_id)}
                            className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 rounded"
                            data-help="transfusion_bedside.inspect_transfusion_btn"
                          >
                            {t("Detail", "تفصیل")}
                          </button>

                          {/* Action: Start (rule:0a07d57ff8) */}
                          {canTransfuse && !isReadOnly && tx.status === "Issued" && (
                            <button
                              onClick={() => openStartModal(tx)}
                              disabled={expired}
                              className={`px-2.5 py-1 text-xs font-bold rounded shadow-sm text-white ${
                                expired
                                  ? "bg-gray-400 cursor-not-allowed"
                                  : "bg-green-600 hover:bg-green-700"
                              }`}
                              data-help="transfusion_bedside.start_transfusion_btn"
                              title={
                                expired
                                  ? "Start threshold expired (>30m). Must record Not Given."
                                  : "Start bedside transfusion verification"
                              }
                            >
                              {t("Start", "شروع کریں")}
                            </button>
                          )}

                          {/* Action: Record Vitals (rule:efcdf1e299) */}
                          {canTransfuse && !isReadOnly && (tx.status === "Issued" || tx.status === "InProgress") && (
                            <button
                              onClick={() => openObsModal(tx)}
                              className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800"
                              data-help="transfusion_bedside.record_vitals_btn"
                            >
                              {t("+ Vitals", "+ وائٹلز")}
                            </button>
                          )}

                          {/* Action: End (rule:efcdf1e299) */}
                          {canTransfuse && !isReadOnly && tx.status === "InProgress" && (
                            <button
                              onClick={() => openEndModal(tx)}
                              className="px-2 py-1 text-xs font-bold rounded text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                              data-help="transfusion_bedside.end_transfusion_btn"
                            >
                              {t("End", "ختم کریں")}
                            </button>
                          )}

                          {/* Action: Adverse Reaction (rule:a2f80c80d7) */}
                          {canTransfuse && !isReadOnly && (tx.status === "InProgress" || tx.status === "Completed") && (
                            <button
                              onClick={() => openReactionModal(tx)}
                              className="px-2 py-1 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 rounded border border-red-300 dark:border-red-800"
                              data-help="transfusion_bedside.report_reaction_btn"
                            >
                              {t("Reaction", "ری ایکشن")}
                            </button>
                          )}

                          {/* Action: Return / Not Given (rule:8e16f20b4a) */}
                          {canTransfuse && !isReadOnly && tx.status === "Issued" && (
                            <button
                              onClick={() => openReturnModal(tx)}
                              className="px-2 py-1 text-xs font-medium text-gray-700 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 rounded"
                              data-help="transfusion_bedside.return_unit_btn"
                            >
                              {t("Return / Not Given", "واپسی")}
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

      {/* TAB 2: TRANSFUSION DETAIL & OBSERVATIONS FLOWSHEET */}
      {activeTab === "detail" && selectedTransfusionDetail && (
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
            <div>
              <span className="text-xs uppercase font-bold text-gray-500">
                {t("Transfusion Flowsheet", "ٹرانسفیوژن فلو شیٹ")}
              </span>
              <h2 className="text-lg font-bold font-mono text-gray-900 dark:text-gray-100">
                Unit {selectedTransfusionDetail.unit_number} • Request {selectedTransfusionDetail.request_number}
              </h2>
            </div>
            <button
              onClick={() => setActiveTab("worklist")}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 rounded"
              data-help="transfusion_bedside.btn_back_to_worklist"
            >
              {t("← Back to Worklist", "← واپس ورک لسٹ")}
            </button>
          </div>

          {/* Patient & Unit Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs">
            <div>
              <span className="text-gray-500">{t("Patient:", "مریض:")}</span>{" "}
              <span className="font-bold">{selectedTransfusionDetail.patient_name}</span>
            </div>
            <div>
              <span className="text-gray-500">{t("MRN:", "ایم آر این:")}</span>{" "}
              <span className="font-mono font-bold">{selectedTransfusionDetail.mrn}</span>
            </div>
            <div>
              <span className="text-gray-500">{t("Blood Group:", "بلڈ گروپ:")}</span>{" "}
              <span className="font-bold text-purple-600">
                {selectedTransfusionDetail.abo} {selectedTransfusionDetail.rh === "Positive" ? "+" : "-"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">{t("Status:", "حالت:")}</span>{" "}
              <span className="font-bold text-blue-600">{selectedTransfusionDetail.status}</span>
            </div>
          </div>

          {/* Observations Flowsheet Table (rule:efcdf1e299) */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase text-gray-700 dark:text-gray-300">
                {t("Vital Signs & Clinical Observations", "وائٹل سائنز و طبی مشاہدات")} (
                {selectedTransfusionDetail.observations.length})
              </h3>
              {canTransfuse && !isReadOnly && (
                <button
                  onClick={() => openObsModal(selectedTransfusionDetail)}
                  className="px-2.5 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm"
                  data-help="transfusion_bedside.btn_detail_add_vitals"
                >
                  {t("+ Record New Observation", "+ نیا مشاہدہ درج کریں")}
                </button>
              )}
            </div>

            {selectedTransfusionDetail.observations.length === 0 ? (
              <div className="text-xs text-gray-500 italic py-2">
                {t("No vital signs recorded yet. Baseline observation is recommended before start.", "کوئی مشاہدہ درج نہیں ہوا۔")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                    <tr>
                      <th className="px-2.5 py-2 text-left">{t("Observed At", "وقت")}</th>
                      <th className="px-2.5 py-2 text-left">{t("Temp (°C)", "حرارت")}</th>
                      <th className="px-2.5 py-2 text-left">{t("Pulse (bpm)", "نبض")}</th>
                      <th className="px-2.5 py-2 text-left">{t("BP (mmHg)", "بلڈ پریشر")}</th>
                      <th className="px-2.5 py-2 text-left">{t("Resp Rate", "سانس")}</th>
                      <th className="px-2.5 py-2 text-left">{t("Note", "نوٹ")}</th>
                      <th className="px-2.5 py-2 text-left">{t("Recorded By", "درج کنندہ")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {selectedTransfusionDetail.observations.map((obs) => (
                      <tr key={obs.observation_id}>
                        <td className="px-2.5 py-1.5 font-mono text-gray-900 dark:text-gray-100">
                          {new Date(obs.observed_at).toLocaleTimeString()}
                        </td>
                        <td className="px-2.5 py-1.5 font-bold">
                          {obs.temperature_c ? `${obs.temperature_c}°C` : "-"}
                        </td>
                        <td className="px-2.5 py-1.5">{obs.pulse || "-"}</td>
                        <td className="px-2.5 py-1.5">
                          {obs.bp_systolic && obs.bp_diastolic
                            ? `${obs.bp_systolic}/${obs.bp_diastolic}`
                            : "-"}
                        </td>
                        <td className="px-2.5 py-1.5">{obs.respiratory_rate || "-"}</td>
                        <td className="px-2.5 py-1.5 text-gray-500">{obs.note || "-"}</td>
                        <td className="px-2.5 py-1.5 text-gray-500">{obs.author_stamp?.name || obs.recorded_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Reaction Report Card (if present) (rule:a2f80c80d7) */}
          {selectedTransfusionDetail.reaction_report && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-lg space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-red-900 dark:text-red-200 uppercase">
                  {t("Transfusion Adverse Reaction Report & Section 13 Incident", "ری ایکشن رپورٹ و سیکشن ۱۳ انسیڈنٹ")}
                </span>
                <span className="font-mono font-bold text-red-700">
                  Incident #: {selectedTransfusionDetail.reaction_report.incident_number}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px]">
                <div>
                  <span className="text-gray-500">Type:</span> {selectedTransfusionDetail.reaction_report.reaction_type}
                </div>
                <div>
                  <span className="text-gray-500">Class:</span> {selectedTransfusionDetail.reaction_report.reaction_class}
                </div>
                <div>
                  <span className="text-gray-500">Signs:</span> {selectedTransfusionDetail.reaction_report.signs}
                </div>
                <div>
                  <span className="text-gray-500">Action:</span> {selectedTransfusionDetail.reaction_report.action_taken}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: BEDSIDE START & DUAL VERIFICATION (rule:0a07d57ff8) */}
      {startModalOpen && targetForStart && (
        <Modal
          title={t("Bedside Safety Verification & Transfusion Start", "بیڈ سائیڈ تصدیق و ٹرانسفیوژن آغاز")}
          onClose={() => setStartModalOpen(false)}
        >
          <div className="space-y-4 text-xs max-h-[75vh] overflow-y-auto pr-1">
            {/* Countdown notice */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded border border-blue-200 dark:border-blue-800 flex justify-between items-center">
              <div>
                <div className="font-bold text-sm text-gray-900 dark:text-gray-100">
                  Unit: {targetForStart.unit_number} ({targetForStart.component}, {targetForStart.abo}{" "}
                  {targetForStart.rh === "Positive" ? "+" : "-"})
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  Patient: {targetForStart.patient_name} (MRN: {targetForStart.mrn})
                </div>
              </div>
              <div className="text-right font-mono font-bold text-sm text-green-600">
                ⏱ {formatCountdown(getStartByRemainingSeconds(targetForStart.start_by))}
              </div>
            </div>

            {/* Step 1: Patient Identity Verification */}
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 space-y-2">
              <span className="font-bold uppercase text-gray-700 dark:text-gray-300">
                {t("Step 1: Patient Identity Verification", "مرحلہ ۱: مریض کی شناخت کی تصدیق")}
              </span>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={t("Scan wristband barcode...", "رسٹ بینڈ بارکوڈ اسکین کریں...")}
                  value={wristbandCode}
                  onChange={(e) => setWristbandCode(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 font-mono flex-1"
                  data-help="transfusion_bedside.wristband_scan_input"
                />
                <button
                  type="button"
                  onClick={handleVerifyWristband}
                  disabled={verifyingWristband || !wristbandCode.trim()}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm"
                  data-help="transfusion_bedside.btn_verify_wristband"
                >
                  {verifyingWristband ? t("Scanning...", "جانچ جاری...") : t("Verify Scan", "تصدیق کریں")}
                </button>
              </div>

              {wristbandResult?.match && (
                <div className="p-2 bg-green-50 text-green-800 border border-green-200 rounded text-xs font-medium">
                  ✓ Scanned wristband MATCHES patient: {wristbandResult.expected_patient.full_name} (MRN:{" "}
                  {wristbandResult.expected_patient.mrn})
                </div>
              )}

              {wristbandError && (
                <div className="p-2 bg-red-50 text-red-800 border border-red-200 rounded text-xs font-medium">
                  ✗ {wristbandError}
                </div>
              )}

              <div className="pt-2 flex items-center gap-3">
                <span className="text-gray-500">{t("Or fallback verification method:", "یا متبادل طریقہ:")}</span>
                {(["WristbandScan", "TwoIdentifiers", "EmergencyOverride"] as const).map((m) => (
                  <label key={m} className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="identityCheckMethod"
                      value={m}
                      checked={identityCheckMethod === m}
                      onChange={() => setIdentityCheckMethod(m)}
                      data-help="transfusion_bedside.radio_identity_method"
                    />
                    <span>{m}</span>
                  </label>
                ))}
              </div>

              {identityCheckMethod !== "WristbandScan" && (
                <Field label={t("Identity Verification Note", "شناخت کا وضاحتی نوٹ")}>
                  <input
                    type="text"
                    placeholder="Document verbal confirmation or emergency override reasoning..."
                    value={identityNote}
                    onChange={(e) => setIdentityNote(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                    data-help="transfusion_bedside.identity_note_input"
                  />
                </Field>
              )}
            </div>

            {/* Step 2: 5 Mandatory Bedside Safety Checkboxes (rule:0a07d57ff8) */}
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 space-y-2">
              <span className="font-bold uppercase text-gray-700 dark:text-gray-300">
                {t(
                  "Step 2: Five Bedside Safety Checks (None Ticked in Advance)",
                  "مرحلہ ۲: پانچ لازمی طبی تصدیقی خانے"
                )}
              </span>

              <div className="space-y-2 pt-1">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkIdentity}
                    onChange={(e) => setCheckIdentity(e.target.checked)}
                    className="mt-0.5"
                    data-help="transfusion_bedside.check_identity"
                  />
                  <span>
                    1. <strong>Identity Check:</strong> Same identity on notes, collection slip, chart, wristband,
                    compatibility form, and label.
                  </span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkUnitNumber}
                    onChange={(e) => setCheckUnitNumber(e.target.checked)}
                    className="mt-0.5"
                    data-help="transfusion_bedside.check_unit_number"
                  />
                  <span>
                    2. <strong>Unit Number:</strong> Unit number ({targetForStart.unit_number}) matches bag label exactly.
                  </span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkExpiry}
                    onChange={(e) => setCheckExpiry(e.target.checked)}
                    className="mt-0.5"
                    data-help="transfusion_bedside.check_expiry"
                  />
                  <span>
                    3. <strong>Expiry:</strong> Not expired; expiry date matches compatibility label.
                  </span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkProduct}
                    onChange={(e) => setCheckProduct(e.target.checked)}
                    className="mt-0.5"
                    data-help="transfusion_bedside.check_product"
                  />
                  <span>
                    4. <strong>Product:</strong> Prescribed component ({targetForStart.component}) and any special
                    requirements met.
                  </span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkBag}
                    onChange={(e) => setCheckBag(e.target.checked)}
                    className="mt-0.5"
                    data-help="transfusion_bedside.check_bag"
                  />
                  <span>
                    5. <strong>Bag Inspection:</strong> Bag is intact; no hemolysis, large clots, turbidity, or
                    discoloration.
                  </span>
                </label>
              </div>
            </div>

            {/* Step 3: Dual Control Co-signature (rule:0a07d57ff8) */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded border border-amber-200 dark:border-amber-800 space-y-3">
              <span className="font-bold uppercase text-amber-900 dark:text-amber-200">
                {t("Step 3: Second Clinician Co-Signature (Dual Control)", "مرحلہ ۳: دوسرے طبیب کے دستخط")}
              </span>
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                {t(
                  "The second nurse or doctor checks with you and co-signs on the same screen (STEP_UP_REQUIRED, DUAL_CONTROL_SAME_PERSON). Cannot be the logged-in user.",
                  "دوسرے نرس یا ڈاکٹر کا اپنے پاس ورڈ سے تصدیق کرنا لازمی ہے۔"
                )}
              </p>

              <Field label={t("Second Checker Username", "دوسرے تصدیق کنندہ کا یوزرنیم")}>
                <input
                  type="text"
                  autoComplete="off"
                  placeholder="Username of second clinician (e.g. demo.headnurse)"
                  value={secondCheckerUsername}
                  onChange={(e) => setSecondCheckerUsername(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 font-mono"
                  data-help="transfusion_bedside.second_checker_username_input"
                />
              </Field>

              <Field label={t("Second Checker Password", "پاس ورڈ")}>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Enter password..."
                  value={secondCheckerPassword}
                  onChange={(e) => setSecondCheckerPassword(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  data-help="transfusion_bedside.second_checker_password_input"
                />
              </Field>
            </div>

            {startValidationError && <ErrorBox error={startValidationError} />}

            <ClinicalWriteFeedback write={write} />

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setStartModalOpen(false);
                  openReturnModal(targetForStart);
                }}
                className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded border border-amber-300"
                data-help="transfusion_bedside.btn_start_fallback_not_given"
              >
                {t("Check Failed? Open 'Not Given'", "جانچ ناکام؟ 'واپسی' درج کریں")}
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStartModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                  data-help="transfusion_bedside.btn_cancel_start"
                >
                  {t("Cancel", "منسوخ")}
                </button>
                <button
                  type="button"
                  onClick={handleStartSubmit}
                  disabled={
                    write.busy ||
                    !checkIdentity ||
                    !checkUnitNumber ||
                    !checkExpiry ||
                    !checkProduct ||
                    !checkBag ||
                    !secondCheckerUsername.trim() ||
                    !secondCheckerPassword.trim()
                  }
                  className="px-4 py-1.5 text-xs font-bold rounded shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  data-help="transfusion_bedside.confirm_start_btn"
                >
                  {write.busy ? t("Starting...", "آغاز ہو رہا ہے...") : t("Co-Sign & Start Transfusion", "تصدیق و آغاز")}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: OBSERVATION ENTRY (rule:efcdf1e299) */}
      {obsModalOpen && targetForObs && (
        <Modal
          title={t("Record Vital Signs & Clinical Observation", "وائٹل سائنز اور طبی مشاہدہ")}
          onClose={() => setObsModalOpen(false)}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("Observed At Timestamp", "وقت")}>
                <input
                  type="datetime-local"
                  value={obsTime}
                  onChange={(e) => setObsTime(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  data-help="transfusion_bedside.obs_time_input"
                />
              </Field>

              <Field label={t("Temperature (°C)", "حرارت (°C)")}>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 37.0"
                  value={obsTemp}
                  onChange={(e) => setObsTemp(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  data-help="transfusion_bedside.obs_temp_input"
                />
              </Field>

              <Field label={t("Pulse (bpm)", "نبض (bpm)")}>
                <input
                  type="number"
                  placeholder="e.g. 78"
                  value={obsPulse}
                  onChange={(e) => setObsPulse(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  data-help="transfusion_bedside.obs_pulse_input"
                />
              </Field>

              <Field label={t("Blood Pressure (Systolic / Diastolic)", "بلڈ پریشر")}>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    placeholder="Sys"
                    value={obsSystolic}
                    onChange={(e) => setObsSystolic(e.target.value)}
                    className="w-1/2 px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                    data-help="transfusion_bedside.obs_systolic_input"
                  />
                  <span>/</span>
                  <input
                    type="number"
                    placeholder="Dia"
                    value={obsDiastolic}
                    onChange={(e) => setObsDiastolic(e.target.value)}
                    className="w-1/2 px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                    data-help="transfusion_bedside.obs_diastolic_input"
                  />
                </div>
              </Field>

              <Field label={t("Respiratory Rate (/min)", "سانس کی رفتار")}>
                <input
                  type="number"
                  placeholder="e.g. 18"
                  value={obsResp}
                  onChange={(e) => setObsResp(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  data-help="transfusion_bedside.obs_resp_input"
                />
              </Field>
            </div>

            <Field label={t("Clinical Observation Note", "طبی نوٹ")}>
              <textarea
                value={obsNote}
                onChange={(e) => setObsNote(e.target.value)}
                placeholder="Patient condition, transfusion rate, flushing, any complaints..."
                rows={2}
                className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                data-help="transfusion_bedside.obs_note_textarea"
              />
            </Field>

            {obsError && <ErrorBox error={obsError} />}

            <ClinicalWriteFeedback write={write} />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setObsModalOpen(false)}
                className="px-3 py-1.5 text-xs text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                data-help="transfusion_bedside.btn_cancel_obs"
              >
                {t("Cancel", "منسوخ")}
              </button>
              <button
                type="button"
                onClick={handleObsSubmit}
                disabled={write.busy}
                className="px-4 py-1.5 text-xs font-bold rounded shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                data-help="transfusion_bedside.submit_obs_btn"
              >
                {write.busy ? t("Recording...", "محفوظ ہو رہا ہے...") : t("Record Vitals", "وائٹلز محفوظ کریں")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: END TRANSFUSION (rule:efcdf1e299) */}
      {endModalOpen && targetForEnd && (
        <Modal
          title={t("End Bedside Blood Transfusion", "بلڈ ٹرانسفیوژن کا خاتمہ")}
          onClose={() => setEndModalOpen(false)}
        >
          <div className="space-y-4 text-xs">
            <Field label={t("Transfusion Outcome", "نتیجہ")}>
              <div className="flex gap-4">
                {(["Completed", "Stopped"] as const).map((outc) => (
                  <label key={outc} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="endOutcome"
                      value={outc}
                      checked={endOutcome === outc}
                      onChange={() => setEndOutcome(outc)}
                      data-help="transfusion_bedside.radio_end_outcome"
                    />
                    <span className="font-semibold">{outc}</span>
                  </label>
                ))}
              </div>
            </Field>

            <Field label={t("Actual Volume Given (mL)", "لگائی گئی مقدار (ملی لیٹر)")}>
              <input
                type="number"
                placeholder="Volume in mL"
                value={endVolume}
                onChange={(e) => setEndVolume(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                data-help="transfusion_bedside.end_volume_input"
              />
            </Field>

            <Field label={t("End Transfusion Note", "اختتامی نوٹ")}>
              <textarea
                value={endNote}
                onChange={(e) => setEndNote(e.target.value)}
                placeholder={
                  endOutcome === "Stopped"
                    ? "Mandatory: Document why transfusion was stopped prematurely..."
                    : "Post-transfusion condition, cannulation site status..."
                }
                rows={3}
                className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                data-help="transfusion_bedside.end_note_textarea"
              />
            </Field>

            {endError && <ErrorBox error={endError} />}

            <ClinicalWriteFeedback write={write} />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEndModalOpen(false)}
                className="px-3 py-1.5 text-xs text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                data-help="transfusion_bedside.btn_cancel_end"
              >
                {t("Cancel", "منسوخ")}
              </button>
              <button
                type="button"
                onClick={handleEndSubmit}
                disabled={write.busy}
                className="px-4 py-1.5 text-xs font-bold rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                data-help="transfusion_bedside.submit_end_btn"
              >
                {write.busy ? t("Ending...", "محفوظ ہو رہا ہے...") : t("Confirm End Transfusion", "خاتمہ محفوظ کریں")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: ADVERSE TRANSFUSION REACTION REPORT (rule:a2f80c80d7) */}
      {reactionModalOpen && targetForReaction && (
        <Modal
          title={t("Punjab Blood Transfusion Authority — Adverse Reaction Report", "پی بی ٹی اے — ری ایکشن رپورٹ و سیکشن ۱۳")}
          onClose={() => setReactionModalOpen(false)}
        >
          <div className="space-y-4 text-xs max-h-[75vh] overflow-y-auto pr-1">
            <div className="p-2.5 bg-red-50 text-red-800 rounded border border-red-200 text-xs">
              {t(
                "PBTA Act s.13 Mandate: Every adverse reaction automatically registers a hospital incident report. Wrong blood / ABO incompatibility is escalated as a Sentinel Event.",
                "قانون کے تحت ہر ری ایکشن کا اسپتال انسیڈنٹ اور پی بی ٹی اے کو رپورٹ ہونا لازمی ہے۔"
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("Reaction Noticed At", "وقت")}>
                <input
                  type="datetime-local"
                  value={rxTime}
                  onChange={(e) => setRxTime(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  data-help="transfusion_bedside.rx_time_input"
                />
              </Field>

              <Field label={t("Reaction Classification", "ری ایکشن کی قسم")}>
                <select
                  value={rxClass}
                  onChange={(e) => setRxClass(e.target.value as any)}
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  data-help="transfusion_bedside.rx_class_select"
                >
                  <option value="Haemolytic">Haemolytic (Acute)</option>
                  <option value="Anaphylactic">Anaphylactic / Severe Allergic</option>
                  <option value="DelayedHaemolytic">Delayed Haemolytic</option>
                  <option value="Bacterial">Bacterial Contamination / Sepsis</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
            </div>

            <Field label={t("Clinical Reaction Type Description", "کلینیکل تفصیل")}>
              <input
                type="text"
                placeholder="e.g. Febrile non-haemolytic, Urticarial rash, Acute hemolysis..."
                value={rxType}
                onChange={(e) => setRxType(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                data-help="transfusion_bedside.rx_type_input"
              />
            </Field>

            <Field label={t("Signs and Symptoms Observed", "علامات")}>
              <textarea
                value={rxSigns}
                onChange={(e) => setRxSigns(e.target.value)}
                placeholder="Rigors, fever spike, hypotension, dyspnoea, haemoglobinuria..."
                rows={2}
                className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                data-help="transfusion_bedside.rx_signs_textarea"
              />
            </Field>

            <Field label={t("Immediate Action Taken", "فوری اقدامات")}>
              <textarea
                value={rxAction}
                onChange={(e) => setRxAction(e.target.value)}
                placeholder="Stopped infusion immediately, normal saline iv, antihistamine, hydrocortisone..."
                rows={2}
                className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                data-help="transfusion_bedside.rx_action_textarea"
              />
            </Field>

            {/* Class specific fields */}
            {rxClass === "DelayedHaemolytic" && (
              <div className="grid grid-cols-2 gap-3 p-2.5 bg-gray-50 dark:bg-gray-800 rounded">
                <Field label={t("Delayed After (Time)", "تاخیر کا وقت")}>
                  <input
                    type="text"
                    placeholder="e.g. 5 days, 1 week"
                    value={rxDelayedAfter}
                    onChange={(e) => setRxDelayedAfter(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700"
                    data-help="transfusion_bedside.rx_delayed_after_input"
                  />
                </Field>
                <Field label={t("Identified Antibody", "شناخت شدہ اینٹی باڈی")}>
                  <input
                    type="text"
                    placeholder="e.g. Anti-Jka, Anti-K"
                    value={rxAntibody}
                    onChange={(e) => setRxAntibody(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700"
                    data-help="transfusion_bedside.rx_antibody_input"
                  />
                </Field>
              </div>
            )}

            {rxClass === "Bacterial" && (
              <Field label={t("Suspected / Cultured Organism", "بیکٹیریا")}>
                <input
                  type="text"
                  placeholder="e.g. Pseudomonas, Yersinia enterocolitica..."
                  value={rxOrganism}
                  onChange={(e) => setRxOrganism(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700"
                  data-help="transfusion_bedside.rx_organism_input"
                />
              </Field>
            )}

            {/* Sentinel event and fatal checkboxes */}
            <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded">
              <label className="flex items-center gap-2 cursor-pointer text-red-600 font-bold">
                <input
                  type="checkbox"
                  checked={rxWrongBlood}
                  onChange={(e) => setRxWrongBlood(e.target.checked)}
                  data-help="transfusion_bedside.rx_wrong_blood_checkbox"
                />
                <span>{t("Wrong Blood / ABO Incompatible Transfusion (Sentinel Event)", "غلط خون یا اے بی او تضاد (سنگین سانحہ)")}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-bold">
                <input
                  type="checkbox"
                  checked={rxFatal}
                  onChange={(e) => {
                    setRxFatal(e.target.checked);
                    if (e.target.checked) setRxHarm("Death");
                  }}
                  data-help="transfusion_bedside.rx_fatal_checkbox"
                />
                <span>{t("Fatal Reaction (Harm = Death)", "جان لیوا ری ایکشن")}</span>
              </label>

              <div className="pt-2">
                <Field label={t("Harm Severity Level", "نقصان کی شدت")}>
                  <select
                    value={rxHarm}
                    onChange={(e) => setRxHarm(e.target.value as any)}
                    disabled={rxFatal}
                    className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                    data-help="transfusion_bedside.rx_harm_select"
                  >
                    <option value="NoHarm">No Harm</option>
                    <option value="Mild">Mild</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Severe">Severe</option>
                    <option value="Death">Death</option>
                  </select>
                </Field>
              </div>
            </div>

            {rxError && <ErrorBox error={rxError} />}

            <ClinicalWriteFeedback write={write} />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReactionModalOpen(false)}
                className="px-3 py-1.5 text-xs text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                data-help="transfusion_bedside.btn_cancel_reaction"
              >
                {t("Cancel", "منسوخ")}
              </button>
              <button
                type="button"
                onClick={handleReactionSubmit}
                disabled={write.busy}
                className="px-4 py-1.5 text-xs font-bold rounded shadow-sm text-white bg-red-600 hover:bg-red-700"
                data-help="transfusion_bedside.submit_reaction_btn"
              >
                {write.busy ? t("Reporting...", "رپورٹ ہو رہا ہے...") : t("Submit Reaction Incident", "ری ایکشن رپورٹ جمع کریں")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: RETURN / NOT GIVEN (rule:8e16f20b4a) */}
      {returnModalOpen && targetForReturn && (
        <Modal
          title={t("Return Blood Unit to Blood Bank or Record Not Given", "بلڈ یونٹ کی واپسی یا نا دینے کا اندراج")}
          onClose={() => setReturnModalOpen(false)}
        >
          <div className="space-y-4 text-xs">
            <Field label={t("Return Status", "واپسی کی حالت")}>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="returnFitForUse"
                    checked={returnFitForUse}
                    onChange={() => setReturnFitForUse(true)}
                    disabled={isUnitOutTooLong(targetForReturn.start_by)}
                    data-help="transfusion_bedside.radio_fit_for_use"
                  />
                  <span>
                    {t(
                      "Fit for Use (Returned to blood bank within 30 min)",
                      "قابل استعمال (۳۰ منٹ کے اندر بلڈ بینک واپسی)"
                    )}
                  </span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="returnFitForUse"
                    checked={!returnFitForUse}
                    onChange={() => setReturnFitForUse(false)}
                    data-help="transfusion_bedside.radio_not_fit_for_use"
                  />
                  <span className="text-red-600 font-bold">
                    {t("Not Given / Discard (Too long out, damaged, discrepancy)", "نا دیا گیا / تلف")}
                  </span>
                </label>
              </div>
            </Field>

            {!returnFitForUse && (
              <Field label={t("Discard Reason", "تلف کرنے کی وجہ")}>
                <select
                  value={returnDiscardReason}
                  onChange={(e) => setReturnDiscardReason(e.target.value as any)}
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  data-help="transfusion_bedside.return_discard_reason_select"
                >
                  <option value="OutOfStorageTooLong">Out Of Storage Too Long (&gt;30 min)</option>
                  <option value="BagDamaged">Bag Damaged / Leaking</option>
                  <option value="IdentityDiscrepancy">Identity Discrepancy on Bedside Check</option>
                  <option value="Expired">Expired</option>
                  <option value="StorageTemperature">Storage Temperature Drift</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
            )}

            <Field label={t("Return Explanation Note", "وضاحتی نوٹ")}>
              <textarea
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
                placeholder="Document reasons for returning unit to the blood refrigerator or discarding..."
                rows={3}
                className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                data-help="transfusion_bedside.return_note_textarea"
              />
            </Field>

            {returnError && <ErrorBox error={returnError} />}

            <ClinicalWriteFeedback write={write} />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReturnModalOpen(false)}
                className="px-3 py-1.5 text-xs text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                data-help="transfusion_bedside.btn_cancel_return"
              >
                {t("Cancel", "منسوخ")}
              </button>
              <button
                type="button"
                onClick={handleReturnSubmit}
                disabled={write.busy}
                className="px-4 py-1.5 text-xs font-bold rounded shadow-sm text-white bg-amber-600 hover:bg-amber-700"
                data-help="transfusion_bedside.submit_return_btn"
              >
                {write.busy ? t("Returning...", "واپس ہو رہا ہے...") : t("Confirm Return", "واپسی محفوظ کریں")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
