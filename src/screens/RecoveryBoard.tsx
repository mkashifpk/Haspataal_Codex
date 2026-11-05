import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { EstablishmentOut } from "../generated/facility_profile";
import type {
  RecoveryBoardOut,
  RecoveryBoardRowOut,
  RecoveryTargetsOut,
  SurgicalRecordOut,
  RecoveryObservationIn,
  RecoveryDischargeIn,
  SurgicalCorrectionIn,
  IncidentIn,
  StaffLookupOut,
} from "../generated/recovery_board";
import {
  recoveryBoard as fetchRecoveryBoard,
  getRecord as getSurgicalRecord,
  openRecovery as postOpenRecovery,
  recoveryObservation as postRecoveryObservation,
  dischargeRecovery as postDischargeRecovery,
  correct as postCorrection,
  reportIncidents,
  lookupStaff,
} from "../generated/recovery_board";
import {
  listTypes as listIncidentTypes,
  IncidentTypeOut,
} from "../generated/safety_checklist";
import {
  getRecoveryBoardScreenView,
  canViewRecoveryBoard,
  canRecordObservation,
  canDischargePatient,
  canOpenRecovery,
  canCorrectRecovery,
  canReportIncident,
  validateObservationInput,
  calculateAldreteScore,
  validateDischargeInput,
  validateCorrectionInput,
  validateIncidentInput,
  explainRecoveryBoardError,
  AIRWAY_STATES,
  CONSCIOUSNESS_LEVELS,
  DISCHARGE_DESTINATIONS,
  ClinicalUser,
} from "../recovery-board-policy";

export interface RecoveryBoardProps {
  establishment?: EstablishmentOut | null;
  currentUser?: ClinicalUser | null;
  connected?: boolean;
  stream?: any;
  timeZone?: string;
  screenId?: string;
  onNavigate?: (screenId: string) => void;
  onNavigateScreen?: (screenId: string) => void;
}

export const RecoveryBoard: React.FC<RecoveryBoardProps> = ({
  establishment,
  currentUser,
  connected = true,
  stream,
  screenId = "recovery_board",
  onNavigate,
  onNavigateScreen,
}) => {
  const navigate = onNavigateScreen || onNavigate;

  // Runtime service capability view
  const viewMode = useMemo(() => {
    return getRecoveryBoardScreenView(establishment, screenId);
  }, [establishment, screenId]);

  // Permissions
  const canView = canViewRecoveryBoard(currentUser);
  const canObs = canRecordObservation(currentUser) && viewMode !== "records";
  const canDischarge = canDischargePatient(currentUser) && viewMode !== "records";
  const canOpen = canOpenRecovery(currentUser) && viewMode === "full";
  const canCorrect = canCorrectRecovery(currentUser);
  const canIncident = canReportIncident(currentUser);

  // Recovery board state
  const [boardData, setBoardData] = useState<RecoveryBoardOut | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<{ en: string; ur: string } | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Selected patient surgical record detail
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [surgicalRecord, setSurgicalRecord] = useState<SurgicalRecordOut | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Open Recovery Stay for Local Anaesthesia modal
  const [showOpenModal, setShowOpenModal] = useState<boolean>(false);
  const [openBookingIdInput, setOpenBookingIdInput] = useState<string>("");

  // Observation Modal
  const [showObsModal, setShowObsModal] = useState<boolean>(false);
  const [obsHr, setObsHr] = useState<string>("");
  const [obsBpSys, setObsBpSys] = useState<string>("");
  const [obsBpDia, setObsBpDia] = useState<string>("");
  const [obsRr, setObsRr] = useState<string>("");
  const [obsSpo2, setObsSpo2] = useState<string>("");
  const [obsAirway, setObsAirway] = useState<"Patent" | "Supported" | "Obstructed">("Patent");
  const [obsConsciousness, setObsConsciousness] = useState<"Alert" | "Voice" | "Pain" | "Unresponsive">("Alert");
  const [obsPain, setObsPain] = useState<string>("0");
  const [obsTemp, setObsTemp] = useState<string>("");
  const [obsNausea, setObsNausea] = useState<boolean>(false);
  const [obsNote, setObsNote] = useState<string>("");

  // Discharge Modal
  const [showDischargeModal, setShowDischargeModal] = useState<boolean>(false);
  const [disDestination, setDisDestination] = useState<
    "Ward" | "ICU" | "HDU" | "Home" | "ReturnedToTheatre" | "Died"
  >("Ward");
  const [disActivity, setDisActivity] = useState<number>(2);
  const [disRespiration, setDisRespiration] = useState<number>(2);
  const [disCirculation, setDisCirculation] = useState<number>(2);
  const [disConsciousness, setDisConsciousness] = useState<number>(2);
  const [disSpo2, setDisSpo2] = useState<number>(2);
  const [disPain, setDisPain] = useState<string>("1");
  const [disOverride, setDisOverride] = useState<string>("");
  const [disShiftingNote, setDisShiftingNote] = useState<string>("");

  // Correction Modal
  const [showCorrectionModal, setShowCorrectionModal] = useState<boolean>(false);
  const [corrText, setCorrText] = useState<string>("");
  const [corrReason, setCorrReason] = useState<string>("");

  // Incident Modal
  const [showIncidentModal, setShowIncidentModal] = useState<boolean>(false);
  const [incidentTypes, setIncidentTypes] = useState<IncidentTypeOut[]>([]);
  const [incidentType, setIncidentType] = useState<string>("");
  const [incidentSummary, setIncidentSummary] = useState<string>("");

  // Staff lookup
  const [staffList, setStaffList] = useState<StaffLookupOut[]>([]);

  const [submitting, setSubmitting] = useState<boolean>(false);

  // Load Board
  const loadBoard = useCallback(async () => {
    try {
      setLoading(true);
      setErrorBanner(null);
      const data = await fetchRecoveryBoard();
      setBoardData(data);
    } catch (err: any) {
      setErrorBanner(explainRecoveryBoardError(err?.code, err?.details));
    } finally {
      setLoading(false);
    }
  }, []);

  // Load selected booking detail
  const loadRecord = useCallback(async (bookingId: number) => {
    try {
      setLoadingDetail(true);
      setErrorBanner(null);
      const rec = await getSurgicalRecord(bookingId);
      setSurgicalRecord(rec);
    } catch (err: any) {
      setErrorBanner(explainRecoveryBoardError(err?.code, err?.details));
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  // Load incident types and staff
  useEffect(() => {
    listIncidentTypes()
      .then(setIncidentTypes)
      .catch(() => {});
  }, []);

  // Real-time synchronization
  useEffect(() => {
    if (!stream) return;
    const unsubscribe = stream.on?.("ot.clinical.updated", () => {
      loadBoard();
      if (selectedBookingId) {
        loadRecord(selectedBookingId);
      }
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [stream, loadBoard, selectedBookingId, loadRecord]);

  // Filtered patients
  const filteredPatients = useMemo(() => {
    if (!boardData?.patients) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return boardData.patients;
    return boardData.patients.filter(
      (p) =>
        p.patient_name.toLowerCase().includes(q) ||
        p.mrn.toLowerCase().includes(q) ||
        p.procedure_name.toLowerCase().includes(q) ||
        p.booking_number.toLowerCase().includes(q) ||
        (p.ot_name && p.ot_name.toLowerCase().includes(q)),
    );
  }, [boardData, searchQuery]);

  // Open Recovery Stay for Local Anaesthesia
  const handleOpenRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bid = Number(openBookingIdInput);
    if (!bid || isNaN(bid)) {
      setErrorBanner({ en: "Please enter a valid numeric Booking ID.", ur: "براہ کرم درست بکنگ نمبر درج کریں۔" });
      return;
    }
    try {
      setSubmitting(true);
      setErrorBanner(null);
      await postOpenRecovery(bid);
      setSuccessBanner(`Recovery stay opened for booking #${bid}.`);
      setTimeout(() => setSuccessBanner(null), 3000);
      setShowOpenModal(false);
      setOpenBookingIdInput("");
      await loadBoard();
      setSelectedBookingId(bid);
      loadRecord(bid);
    } catch (err: any) {
      setErrorBanner(explainRecoveryBoardError(err?.code, err?.details));
    } finally {
      setSubmitting(false);
    }
  };

  // Submit PACU Observation
  const handleObsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingId) return;

    const obsIn: RecoveryObservationIn = {
      heart_rate: Number(obsHr),
      bp_systolic: Number(obsBpSys),
      bp_diastolic: Number(obsBpDia),
      respiratory_rate: Number(obsRr),
      spo2: Number(obsSpo2),
      airway: obsAirway,
      consciousness: obsConsciousness,
      pain_score: Number(obsPain),
      temp_c: obsTemp ? Number(obsTemp) : null,
      nausea_vomiting: obsNausea,
      note: obsNote.trim() || null,
    };

    const err = validateObservationInput(obsIn);
    if (err) {
      setErrorBanner({ en: err, ur: "درج شدہ ڈیٹا کی تصدیق کریں؛ تمام خانے درست ہونا لازمی ہیں۔" });
      return;
    }

    try {
      setSubmitting(true);
      setErrorBanner(null);
      await postRecoveryObservation(selectedBookingId, obsIn);
      setSuccessBanner("PACU observation reading recorded successfully.");
      setTimeout(() => setSuccessBanner(null), 3000);
      setShowObsModal(false);
      setObsHr("");
      setObsBpSys("");
      setObsBpDia("");
      setObsRr("");
      setObsSpo2("");
      setObsNote("");
      loadRecord(selectedBookingId);
      loadBoard();
    } catch (err: any) {
      setErrorBanner(explainRecoveryBoardError(err?.code, err?.details));
    } finally {
      setSubmitting(false);
    }
  };

  // Submit PACU Discharge
  const handleDischargeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingId) return;

    const disIn: RecoveryDischargeIn = {
      destination: disDestination,
      score_activity: disActivity,
      score_respiration: disRespiration,
      score_circulation: disCirculation,
      score_consciousness: disConsciousness,
      score_spo2: disSpo2,
      pain_score: Number(disPain),
      override_reason: disOverride.trim() || null,
      shifting_note: disShiftingNote.trim() || null,
    };

    const err = validateDischargeInput(disIn, boardData?.targets);
    if (err) {
      setErrorBanner({ en: err, ur: "ڈسچارج کے معیارات پورے نہیں ہیں؛ کلینیکل جواز یا مکمل نوٹس درکار ہیں۔" });
      return;
    }

    try {
      setSubmitting(true);
      setErrorBanner(null);
      await postDischargeRecovery(selectedBookingId, disIn);
      setSuccessBanner("Patient discharged from PACU recovery successfully.");
      setTimeout(() => setSuccessBanner(null), 3000);
      setShowDischargeModal(false);
      setDisOverride("");
      setDisShiftingNote("");
      loadRecord(selectedBookingId);
      loadBoard();
    } catch (err: any) {
      setErrorBanner(explainRecoveryBoardError(err?.code, err?.details));
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Correction Addendum
  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingId) return;

    const corrIn: SurgicalCorrectionIn = {
      record: "Recovery",
      correction_text: corrText.trim(),
      correction_reason: corrReason.trim(),
    };

    const err = validateCorrectionInput(corrIn);
    if (err) {
      setErrorBanner({ en: err, ur: "درستی کی عبارت اور آڈٹ کا سبب درج کرنا لازمی ہے۔" });
      return;
    }

    try {
      setSubmitting(true);
      setErrorBanner(null);
      await postCorrection(selectedBookingId, corrIn);
      setShowCorrectionModal(false);
      setCorrText("");
      setCorrReason("");
      setSuccessBanner("Recovery correction addendum saved.");
      setTimeout(() => setSuccessBanner(null), 3000);
      loadRecord(selectedBookingId);
    } catch (err: any) {
      setErrorBanner(explainRecoveryBoardError(err?.code, err?.details));
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Incident Report
  const handleIncidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const incIn: IncidentIn = {
      type_code: incidentType,
      description: incidentSummary.trim(),
      immediate_action: "Immediate PACU observation and intervention",
      occurred_at: new Date().toISOString(),
      affected: "Patient",
      ot_phase: "Recovery",
      booking_id: selectedBookingId || undefined,
    };

    const err = validateIncidentInput(incIn);
    if (err) {
      setErrorBanner({ en: err, ur: "واقعے کی تفصیل اور قسم منتخب کرنا لازمی ہے۔" });
      return;
    }

    try {
      setSubmitting(true);
      setErrorBanner(null);
      await reportIncidents(incIn);
      setShowIncidentModal(false);
      setIncidentType("");
      setIncidentSummary("");
      setSuccessBanner("Adverse incident reported to hospital quality assurance.");
      setTimeout(() => setSuccessBanner(null), 3000);
      if (selectedBookingId) loadRecord(selectedBookingId);
    } catch (err: any) {
      setErrorBanner(explainRecoveryBoardError(err?.code, err?.details));
    } finally {
      setSubmitting(false);
    }
  };

  const calculatedScore = useMemo(() => {
    return calculateAldreteScore(disActivity, disRespiration, disCirculation, disConsciousness, disSpo2);
  }, [disActivity, disRespiration, disCirculation, disConsciousness, disSpo2]);

  if (!canView) {
    return (
      <div className="p-6 max-w-4xl mx-auto bg-white rounded shadow text-center">
        <h2 className="text-xl font-bold text-red-600 mb-2">Access Denied / رسائی ممنوع ہے</h2>
        <p className="text-gray-600 text-sm">
          You do not have permission to view the PACU Recovery Board. Requires role: OT Nurse, Head Nurse, Anaesthetist, or OT Admin.
        </p>
      </div>
    );
  }

  if (viewMode === "hidden") {
    return (
      <div className="p-6 max-w-4xl mx-auto bg-white rounded shadow text-center">
        <h2 className="text-lg font-bold text-gray-500">Service Not Active / سروس دستیاب نہیں ہے</h2>
        <p className="text-gray-500 text-sm mt-1">Surgery service is not enabled for this facility.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto p-4 bg-slate-50 min-h-screen text-slate-900">
      {/* Capability View Banners */}
      {viewMode === "open_work" && (
        <div className="p-3 bg-amber-50 border-l-4 border-amber-500 text-amber-900 text-sm rounded shadow-sm">
          <strong>Notice:</strong> Surgery service is retiring. Existing patients in recovery continue care; no new surgical admissions permitted.
        </div>
      )}
      {viewMode === "records" && (
        <div className="p-3 bg-blue-50 border-l-4 border-blue-500 text-blue-900 text-sm rounded shadow-sm">
          <strong>Records Mode:</strong> Surgery service is retired. Historical PACU recovery records and audit addenda available in read-only mode.
        </div>
      )}

      {/* Global Alerts */}
      {errorBanner && (
        <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-900 text-sm rounded shadow-sm flex justify-between items-start">
          <div>
            <p className="font-semibold">{errorBanner.en}</p>
            <p className="text-xs text-red-700 mt-0.5 font-urdu">{errorBanner.ur}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            data-help="recovery_board.refresh_btn"
            className="text-red-500 hover:text-red-700 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}
      {successBanner && (
        <div className="p-3 bg-green-50 border-l-4 border-green-500 text-green-900 text-sm rounded shadow-sm flex justify-between items-center">
          <p className="font-semibold">{successBanner}</p>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            data-help="recovery_board.refresh_btn"
            className="text-green-600 hover:text-green-800 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Top Header & PACU Metric Bar */}
      <div className="bg-white p-4 rounded shadow-sm border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">Live PACU Recovery Board</h1>
            <span className="text-xs px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded font-medium">
              {boardData?.patients?.length || 0} In Recovery
            </span>
            {screenId !== "recovery_board" && (
              <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-mono">
                {screenId}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Post-Anaesthesia Care Unit: vitals tracking (MSDS 38), discharge prerequisites, and Aldrete scoring (MSDS 39).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {boardData?.targets && (
            <div className="text-xs text-gray-600 border-r pr-3 mr-1 flex gap-3">
              <span>Obs Frequency: <strong>{boardData.targets.observation_minutes} min</strong></span>
              <span>Min Score: <strong>{boardData.targets.min_score}/10</strong></span>
              <span>Max Pain: <strong>{boardData.targets.max_pain}/10</strong></span>
            </div>
          )}

          {canOpen && (
            <button
              type="button"
              onClick={() => setShowOpenModal(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-sm"
              data-help="recovery_board.open_recovery_btn"
            >
              + Open Recovery Stay
            </button>
          )}

          <button
            type="button"
            onClick={loadBoard}
            disabled={loading}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium border"
            data-help="recovery_board.refresh_btn"
          >
            {loading ? "Refreshing..." : "↻ Refresh Board"}
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-3 rounded shadow-sm border flex items-center gap-3">
        <label className="text-xs font-medium text-gray-700">Filter Patients:</label>
        <input
          type="text"
          placeholder="Search by patient name, MRN, procedure, OT room, booking #..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-3 py-1.5 border rounded text-xs"
          data-help="recovery_board.search_input"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            data-help="recovery_board.search_input"
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Main Grid: Left = Patients Cards Queue, Right = Detailed Patient View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: PACU Patient Cards (Sorted Longest First, Rule f995066a59) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Recovery Patients (Longest First)
            </span>
            <span className="text-xs text-gray-400">Total: {filteredPatients.length}</span>
          </div>

          {filteredPatients.length === 0 ? (
            <div className="p-8 bg-white rounded border text-center text-gray-500 text-sm">
              {loading ? "Loading PACU patients..." : "No patients currently in PACU recovery."}
            </div>
          ) : (
            filteredPatients.map((p) => {
              const isSelected = selectedBookingId === p.booking_id;
              const hasNoObs = p.flags?.includes("NoObservation");
              const hasOverdueObs = p.flags?.includes("ObservationOverdue");
              const isLongStay = p.flags?.includes("LongStay");
              const opNoteUnsigned = p.flags?.includes("OperativeNoteUnsigned");
              const anaesthOpen = p.flags?.includes("AnaesthesiaRecordOpen");

              return (
                <button
                  type="button"
                  key={p.recovery_id}
                  onClick={() => {
                    setSelectedBookingId(p.booking_id);
                    loadRecord(p.booking_id);
                  }}
                  className={`text-left w-full p-3.5 rounded border transition cursor-pointer relative shadow-sm ${
                    isSelected
                      ? "bg-indigo-50/70 border-indigo-500 ring-1 ring-indigo-400"
                      : "bg-white hover:border-gray-400"
                  }`}
                  data-help="recovery_board.patient_card_select"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="font-bold text-sm text-gray-900">{p.patient_name}</div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">
                        MRN: {p.mrn} | #{p.booking_number}
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-block text-xs font-bold px-2 py-0.5 rounded ${
                          isLongStay
                            ? "bg-amber-100 text-amber-900 font-bold"
                            : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        ⏱ {p.minutes_in_recovery} min
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-gray-700">
                    <p className="font-medium text-indigo-950">{p.procedure_name}</p>
                    <p className="text-gray-500 mt-0.5">
                      Surgeon: {p.surgeon_name} {p.ot_name && `• Room: ${p.ot_name}`}
                    </p>
                  </div>

                  {/* Vitals Summary Card */}
                  <div className="mt-2.5 pt-2 border-t flex flex-wrap items-center justify-between gap-1 text-[11px] text-gray-600">
                    <span>
                      Vitals:{" "}
                      {p.heart_rate !== null && p.bp_systolic !== null ? (
                        <strong>
                          HR {p.heart_rate} | BP {p.bp_systolic}/{p.bp_diastolic}
                        </strong>
                      ) : (
                        <span className="text-red-500 font-semibold">No readings</span>
                      )}
                    </span>
                    <span className="text-gray-400">
                      Last obs: {p.last_observed_at ? new Date(p.last_observed_at).toLocaleTimeString() : "Never"}
                    </span>
                  </div>

                  {/* Statutory Status Badges & Prerequisite Warnings (Rule f995066a59) */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {hasNoObs && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[10px]">
                        ● No Observation
                      </span>
                    )}
                    {hasOverdueObs && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[10px]">
                        ⚠ Vitals Overdue
                      </span>
                    )}
                    {isLongStay && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[10px]">
                        ⏳ Long Stay (&gt;{boardData?.targets?.max_stay_minutes}m)
                      </span>
                    )}
                    {opNoteUnsigned && (
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-900 rounded text-[10px] font-medium">
                        Waiting Surgeon Operative Note
                      </span>
                    )}
                    {anaesthOpen && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-900 rounded text-[10px] font-medium">
                        Waiting Anaesthesia Sign-Off
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right Column: Selected Case Details, Observations Flowsheet & Actions */}
        <div className="lg:col-span-7 bg-white rounded border shadow-sm p-4 min-h-[480px]">
          {!selectedBookingId ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-400">
              <span className="text-4xl mb-2">📋</span>
              <p className="text-sm">Select a patient card on the left to view observations, record readings, or manage discharge.</p>
            </div>
          ) : loadingDetail ? (
            <div className="p-8 text-center text-gray-500 text-sm">Loading surgical & recovery record...</div>
          ) : surgicalRecord ? (
            <div className="space-y-4">
              {/* Header Context Banner */}
              <div className="border-b pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-900">
                      {surgicalRecord.booking.patient_name}
                    </h2>
                    <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-mono">
                      {surgicalRecord.booking.mrn}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                      {surgicalRecord.booking.gender}, {surgicalRecord.booking.age_years ?? "--"}y
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {surgicalRecord.booking.procedure_name} • Surgeon: {surgicalRecord.booking.surgeon_name}
                  </p>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {canObs && (
                    <button
                      type="button"
                      onClick={() => setShowObsModal(true)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-sm"
                      data-help="recovery_board.open_obs_modal_btn"
                    >
                      + Record Vitals
                    </button>
                  )}
                  {canDischarge && (
                    <button
                      type="button"
                      onClick={() => setShowDischargeModal(true)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-sm"
                      data-help="recovery_board.open_discharge_modal_btn"
                    >
                      ✓ Discharge Patient
                    </button>
                  )}
                </div>
              </div>

              {/* PACU Discharge Prerequisites Status Card */}
              <div className="p-3 bg-slate-50 rounded border text-xs space-y-1.5">
                <span className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">
                  PACU Discharge Prerequisites:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] text-white font-bold ${
                        surgicalRecord.operative_note?.signed_at ? "bg-emerald-600" : "bg-red-500"
                      }`}
                    >
                      {surgicalRecord.operative_note?.signed_at ? "✓" : "!"}
                    </span>
                    <span>
                      Surgeon Operative Note:{" "}
                      <strong>
                        {surgicalRecord.operative_note?.signed_at ? "Signed & Post-Op Orders Filed" : "Pending Signature"}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] text-white font-bold ${
                        surgicalRecord.anaesthesia_record?.signed_at ? "bg-emerald-600" : "bg-red-500"
                      }`}
                    >
                      {surgicalRecord.anaesthesia_record?.signed_at ? "✓" : "!"}
                    </span>
                    <span>
                      Anaesthesia Record:{" "}
                      <strong>
                        {surgicalRecord.anaesthesia_record?.signed_at ? "Signed & Finalized" : "Open / Incomplete"}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* PACU Recovery Observations Flowsheet Table (MSDS 38) */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    PACU Physiological Observations Flowsheet (MSDS 38)
                  </h3>
                  <span className="text-xs text-gray-400">
                    Readings: {surgicalRecord.recovery?.observations?.length || 0}
                  </span>
                </div>

                {!surgicalRecord.recovery?.observations || surgicalRecord.recovery.observations.length === 0 ? (
                  <div className="p-4 bg-gray-50 rounded border text-center text-xs text-gray-500">
                    No observations charted yet. Click "+ Record Vitals" to enter post-op vitals.
                  </div>
                ) : (
                  <div className="overflow-x-auto border rounded">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-50 font-semibold text-gray-700">
                        <tr>
                          <th className="px-2.5 py-1.5 text-left">Time</th>
                          <th className="px-2 py-1.5 text-left">HR</th>
                          <th className="px-2 py-1.5 text-left">BP</th>
                          <th className="px-2 py-1.5 text-left">RR</th>
                          <th className="px-2 py-1.5 text-left">SpO2</th>
                          <th className="px-2 py-1.5 text-left">Airway</th>
                          <th className="px-2 py-1.5 text-left">AVPU</th>
                          <th className="px-2 py-1.5 text-left">Pain</th>
                          <th className="px-2 py-1.5 text-left">Temp</th>
                          <th className="px-2.5 py-1.5 text-left">Recorded By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {surgicalRecord.recovery.observations.map((obs) => (
                          <tr key={obs.observation_id} className="hover:bg-slate-50">
                            <td className="px-2.5 py-1.5 font-mono text-gray-500">
                              {new Date(obs.recorded_at).toLocaleTimeString()}
                            </td>
                            <td className="px-2 py-1.5 font-semibold text-gray-900">{obs.heart_rate}</td>
                            <td className="px-2 py-1.5">
                              {obs.bp_systolic}/{obs.bp_diastolic}
                            </td>
                            <td className="px-2 py-1.5">{obs.respiratory_rate}</td>
                            <td className="px-2 py-1.5 font-semibold text-indigo-700">{obs.spo2}%</td>
                            <td className="px-2 py-1.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] ${
                                  obs.airway === "Patent"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800 font-bold"
                                }`}
                              >
                                {obs.airway}
                              </span>
                            </td>
                            <td className="px-2 py-1.5">{obs.consciousness}</td>
                            <td className="px-2 py-1.5">
                              <span
                                className={`font-semibold ${
                                  obs.pain_score > 3 ? "text-amber-700" : "text-gray-700"
                                }`}
                              >
                                {obs.pain_score}/10
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-gray-500">{obs.temp_c ? `${obs.temp_c}°C` : "--"}</td>
                            <td className="px-2.5 py-1.5 text-gray-600 truncate max-w-[120px]">
                              {obs.recorded_by_name}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Shifting & Handover Summary if Discharged */}
              {surgicalRecord.recovery?.status === "Discharged" && (
                <div className="p-3 bg-emerald-50 rounded border border-emerald-300 text-xs text-emerald-950 space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>
                      ✓ Patient Discharged to: {surgicalRecord.recovery.destination}
                    </span>
                    <span>
                      Aldrete Score: {surgicalRecord.recovery.score_total}/10
                    </span>
                  </div>
                  <p className="text-gray-600 mt-1">
                    <strong>Handover Note:</strong> {surgicalRecord.recovery.shifting_note || "None recorded"}
                  </p>
                </div>
              )}

              {/* Corrections & In-Theatre Incidents Panel */}
              <div className="pt-3 border-t flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  {canCorrect && (
                    <button
                      type="button"
                      onClick={() => setShowCorrectionModal(true)}
                      className="px-2.5 py-1 text-xs text-gray-700 bg-gray-100 hover:bg-gray-200 border rounded"
                      data-help="recovery_board.open_correction_btn"
                    >
                      + Add Correction
                    </button>
                  )}
                  {canIncident && (
                    <button
                      type="button"
                      onClick={() => setShowIncidentModal(true)}
                      className="px-2.5 py-1 text-xs text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded"
                      data-help="recovery_board.open_incident_btn"
                    >
                      ⚠ Report Incident
                    </button>
                  )}
                </div>

                {navigate && (
                  <button
                    type="button"
                    onClick={() => navigate("surgical_record_surgeon")}
                    className="text-xs text-indigo-600 hover:underline"
                    data-help="recovery_board.view_record_btn"
                  >
                    View Full Surgical Record →
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* MODAL: Open Recovery Stay for Local Anaesthesia */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-base font-bold text-gray-900">
              Open PACU Recovery Stay
            </h3>
            <p className="text-xs text-gray-500">
              For local or regional anaesthesia cases where patient transitions directly to recovery post-procedure.
            </p>
            <form onSubmit={handleOpenRecoverySubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700">Surgical Booking ID *</label>
                <input
                  type="number"
                  required
                  placeholder="Enter Booking ID (e.g. 101)"
                  value={openBookingIdInput}
                  onChange={(e) => setOpenBookingIdInput(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded text-xs mt-1"
                  data-help="recovery_board.open_recovery_booking_select"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowOpenModal(false)}
                  data-help="recovery_board.open_recovery_cancel_btn"
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold"
                  data-help="recovery_board.open_recovery_btn"
                >
                  {submitting ? "Opening..." : "Confirm Arrival in Recovery"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Record Vitals Observation (Rule 08ba1ce134) */}
      {showObsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-5 space-y-4">
            <h3 className="text-base font-bold text-gray-900">
              Record PACU Physiological Observation (MSDS 38)
            </h3>
            <p className="text-xs text-gray-500">
              All physiological parameters, airway patency, and AVPU consciousness are required by statutory policy.
            </p>

            <form onSubmit={handleObsSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-medium text-gray-700">Heart Rate (bpm) *</label>
                  <input
                    type="number"
                    required
                    min={20}
                    max={300}
                    placeholder="e.g. 78"
                    value={obsHr}
                    onChange={(e) => setObsHr(e.target.value)}
                    className="w-full px-2.5 py-1.5 border rounded text-xs mt-1"
                    data-help="recovery_board.obs_hr"
                  />
                </div>

                <div>
                  <label className="font-medium text-gray-700">BP Systolic (mmHg) *</label>
                  <input
                    type="number"
                    required
                    min={40}
                    max={300}
                    placeholder="e.g. 120"
                    value={obsBpSys}
                    onChange={(e) => setObsBpSys(e.target.value)}
                    className="w-full px-2.5 py-1.5 border rounded text-xs mt-1"
                    data-help="recovery_board.obs_bp_sys"
                  />
                </div>

                <div>
                  <label className="font-medium text-gray-700">BP Diastolic (mmHg) *</label>
                  <input
                    type="number"
                    required
                    min={20}
                    max={200}
                    placeholder="e.g. 80"
                    value={obsBpDia}
                    onChange={(e) => setObsBpDia(e.target.value)}
                    className="w-full px-2.5 py-1.5 border rounded text-xs mt-1"
                    data-help="recovery_board.obs_bp_dia"
                  />
                </div>

                <div>
                  <label className="font-medium text-gray-700">Respiration (bpm) *</label>
                  <input
                    type="number"
                    required
                    min={4}
                    max={80}
                    placeholder="e.g. 16"
                    value={obsRr}
                    onChange={(e) => setObsRr(e.target.value)}
                    className="w-full px-2.5 py-1.5 border rounded text-xs mt-1"
                    data-help="recovery_board.obs_rr"
                  />
                </div>

                <div>
                  <label className="font-medium text-gray-700">SpO2 (%) *</label>
                  <input
                    type="number"
                    required
                    min={40}
                    max={100}
                    placeholder="e.g. 98"
                    value={obsSpo2}
                    onChange={(e) => setObsSpo2(e.target.value)}
                    className="w-full px-2.5 py-1.5 border rounded text-xs mt-1"
                    data-help="recovery_board.obs_spo2"
                  />
                </div>

                <div>
                  <label className="font-medium text-gray-700">Airway Patency *</label>
                  <select
                    value={obsAirway}
                    onChange={(e) => setObsAirway(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border rounded text-xs mt-1 bg-white"
                    data-help="recovery_board.obs_airway"
                  >
                    {AIRWAY_STATES.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-medium text-gray-700">AVPU Consciousness *</label>
                  <select
                    value={obsConsciousness}
                    onChange={(e) => setObsConsciousness(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border rounded text-xs mt-1 bg-white"
                    data-help="recovery_board.obs_consciousness"
                  >
                    {CONSCIOUSNESS_LEVELS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-medium text-gray-700">Pain Score (0-10) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={10}
                    value={obsPain}
                    onChange={(e) => setObsPain(e.target.value)}
                    className="w-full px-2.5 py-1.5 border rounded text-xs mt-1"
                    data-help="recovery_board.obs_pain"
                  />
                </div>

                <div>
                  <label className="font-medium text-gray-700">Temperature (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 36.8"
                    value={obsTemp}
                    onChange={(e) => setObsTemp(e.target.value)}
                    className="w-full px-2.5 py-1.5 border rounded text-xs mt-1"
                    data-help="recovery_board.obs_temp"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="obsNausea"
                  checked={obsNausea}
                  onChange={(e) => setObsNausea(e.target.checked)}
                  data-help="recovery_board.obs_nausea"
                />
                <label htmlFor="obsNausea" className="text-gray-700">Patient exhibits nausea or vomiting</label>
              </div>

              <div>
                <label className="font-medium text-gray-700">Clinical Observations Note</label>
                <input
                  type="text"
                  placeholder="e.g. Shivering settled with warm blanket, dressing dry"
                  value={obsNote}
                  onChange={(e) => setObsNote(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded text-xs mt-1"
                  data-help="recovery_board.obs_note"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowObsModal(false)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium"
                  data-help="recovery_board.obs_cancel_btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold"
                  data-help="recovery_board.obs_submit_btn"
                >
                  {submitting ? "Saving..." : "Save Observation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Discharge Patient (Rule 99dea44a26) */}
      {showDischargeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full p-5 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-base font-bold text-gray-900">
                PACU Recovery Discharge & Aldrete Evaluation
              </h3>
              <div className="text-right">
                <span
                  className={`text-sm font-bold px-2 py-0.5 rounded ${
                    calculatedScore >= (boardData?.targets?.min_score ?? 9)
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  Aldrete: {calculatedScore}/10
                </span>
              </div>
            </div>

            <form onSubmit={handleDischargeSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-gray-700">Discharge Destination *</label>
                <select
                  value={disDestination}
                  onChange={(e) => setDisDestination(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border rounded text-xs mt-1 bg-white"
                  data-help="recovery_board.dis_destination"
                >
                  {DISCHARGE_DESTINATIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* 5 Modified Aldrete Score Components (0-2) */}
              <div className="p-3 bg-slate-50 rounded border space-y-2">
                <span className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">
                  Modified Aldrete Scoring (Target: ≥{boardData?.targets?.min_score ?? 9}/10)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-gray-700">Activity (0-2):</label>
                    <select
                      value={disActivity}
                      onChange={(e) => setDisActivity(Number(e.target.value))}
                      className="w-full px-2 py-1 border rounded text-xs mt-0.5 bg-white"
                      data-help="recovery_board.dis_activity"
                    >
                      <option value={2}>2 - Able to move 4 extremities</option>
                      <option value={1}>1 - Able to move 2 extremities</option>
                      <option value={0}>0 - Able to move 0 extremities</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-gray-700">Respiration (0-2):</label>
                    <select
                      value={disRespiration}
                      onChange={(e) => setDisRespiration(Number(e.target.value))}
                      className="w-full px-2 py-1 border rounded text-xs mt-0.5 bg-white"
                      data-help="recovery_board.dis_respiration"
                    >
                      <option value={2}>2 - Breathes deeply & coughs freely</option>
                      <option value={1}>1 - Dyspnoeic or limited breathing</option>
                      <option value={0}>0 - Apnoeic / obstructed</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-gray-700">Circulation (0-2):</label>
                    <select
                      value={disCirculation}
                      onChange={(e) => setDisCirculation(Number(e.target.value))}
                      className="w-full px-2 py-1 border rounded text-xs mt-0.5 bg-white"
                      data-help="recovery_board.dis_circulation"
                    >
                      <option value={2}>2 - BP within ±20% of pre-op</option>
                      <option value={1}>1 - BP within ±20-49% of pre-op</option>
                      <option value={0}>0 - BP within ±50% of pre-op</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-gray-700">Consciousness (0-2):</label>
                    <select
                      value={disConsciousness}
                      onChange={(e) => setDisConsciousness(Number(e.target.value))}
                      className="w-full px-2 py-1 border rounded text-xs mt-0.5 bg-white"
                      data-help="recovery_board.dis_consciousness"
                    >
                      <option value={2}>2 - Fully awake</option>
                      <option value={1}>1 - Arousable on calling</option>
                      <option value={0}>0 - Not responding</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-gray-700">Oxygen Saturation (0-2):</label>
                    <select
                      value={disSpo2}
                      onChange={(e) => setDisSpo2(Number(e.target.value))}
                      className="w-full px-2 py-1 border rounded text-xs mt-0.5 bg-white"
                      data-help="recovery_board.dis_spo2"
                    >
                      <option value={2}>2 - SpO2 &gt;92% on room air</option>
                      <option value={1}>1 - Needs supplemental O2 for &gt;90%</option>
                      <option value={0}>0 - SpO2 &lt;90% despite O2</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-gray-700">Pain Score (0-10):</label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={10}
                      value={disPain}
                      onChange={(e) => setDisPain(e.target.value)}
                      className="w-full px-2 py-1 border rounded text-xs mt-0.5"
                      data-help="recovery_board.dis_pain"
                    />
                  </div>
                </div>
              </div>

              {/* Premature Discharge Override Rationale (Rule 99dea44a26) */}
              {calculatedScore < (boardData?.targets?.min_score ?? 9) && (
                <div className="p-2.5 bg-amber-50 rounded border border-amber-300">
                  <label className="font-bold text-amber-900 block">
                    Clinical Override Reason * (Score below {boardData?.targets?.min_score ?? 9})
                  </label>
                  <p className="text-[11px] text-amber-700 mb-1">
                    Rule 99dea44a26: Discharging below target criteria requires explicit justification.
                  </p>
                  <input
                    type="text"
                    required
                    placeholder="Enter clinical rationale for early discharge..."
                    value={disOverride}
                    onChange={(e) => setDisOverride(e.target.value)}
                    className="w-full px-2.5 py-1.5 border rounded text-xs bg-white"
                    data-help="recovery_board.dis_override"
                  />
                </div>
              )}

              <div>
                <label className="font-medium text-gray-700">Shifting Handover Note (MSDS 39) *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Document transfer SBAR handover, receiving nurse/ward name, IV status, drains..."
                  value={disShiftingNote}
                  onChange={(e) => setDisShiftingNote(e.target.value)}
                  className="w-full px-2.5 py-1.5 border rounded text-xs mt-1"
                  data-help="recovery_board.dis_shifting_note"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowDischargeModal(false)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium"
                  data-help="recovery_board.dis_cancel_btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold"
                  data-help="recovery_board.dis_submit_btn"
                >
                  {submitting ? "Discharging..." : "Execute Discharge"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Retrospective Correction Addendum (Rule 9e9cb593cb) */}
      {showCorrectionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-base font-bold text-gray-900">Add Recovery Correction Addendum</h3>
            <p className="text-xs text-gray-500">
              Rule 9e9cb593cb: Appends a factual correction to the permanent audit ledger for Recovery.
            </p>

            <form onSubmit={handleCorrectionSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-gray-700">Correction Narrative *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Enter factual corrections or additional timing details..."
                  value={corrText}
                  onChange={(e) => setCorrText(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded text-xs mt-1"
                  data-help="recovery_board.corr_text"
                />
              </div>

              <div>
                <label className="font-medium text-gray-700">Audit Justification Reason *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Factual timing correction after charting review"
                  value={corrReason}
                  onChange={(e) => setCorrReason(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded text-xs mt-1"
                  data-help="recovery_board.corr_reason"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium"
                  data-help="recovery_board.corr_cancel_btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold"
                  data-help="recovery_board.corr_submit_btn"
                >
                  {submitting ? "Saving..." : "Submit Addendum"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Report Incident (Rule fe0c435dc9) */}
      {showIncidentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-base font-bold text-gray-900">Report Adverse Incident in PACU</h3>
            <p className="text-xs text-gray-500">
              Rule fe0c435dc9: Files a formal incident report to hospital quality assurance.
            </p>

            <form onSubmit={handleIncidentSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-gray-700">Incident Classification *</label>
                <select
                  required
                  value={incidentType}
                  onChange={(e) => setIncidentType(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded text-xs mt-1 bg-white"
                  data-help="recovery_board.incident_type"
                >
                  <option value="">Select classification...</option>
                  {incidentTypes.map((t) => (
                    <option key={t.type_code} value={t.type_code}>
                      {t.name} ({t.area})
                    </option>
                  ))}
                  <option value="PACU_RESP_DEPRESSION">Respiratory Depression in PACU</option>
                  <option value="PACU_HYPOTENSION">Severe Hypotension Post-Op</option>
                  <option value="PACU_DELIRIUM">Emergence Delirium / Agitation</option>
                  <option value="PACU_BLEEDING">Excessive Wound / Drain Haemorrhage</option>
                </select>
              </div>

              <div>
                <label className="font-medium text-gray-700">Clinical Incident Description *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe event, clinical observations, immediate measures taken, and outcome..."
                  value={incidentSummary}
                  onChange={(e) => setIncidentSummary(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded text-xs mt-1"
                  data-help="recovery_board.incident_summary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowIncidentModal(false)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium"
                  data-help="recovery_board.incident_cancel_btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold"
                  data-help="recovery_board.incident_submit_btn"
                >
                  {submitting ? "Reporting..." : "Submit Incident Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
