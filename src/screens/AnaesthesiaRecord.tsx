import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { EstablishmentOut } from "../generated/facility_profile";
import type {
  SurgicalRecordOut,
  AnaesthesiaRecordOut,
  AnaesthesiaRecordIn,
  AnaesthesiaVitalsIn,
  AnaesthesiaEventIn,
  SurgicalCorrectionIn,
  IncidentIn,
  IncidentDetailOut,
} from "../generated/anaesthesia_record";
import {
  getRecord as getSurgicalRecord,
  anaesthesiaRecord as updateAnaesthesiaRecord,
  anaesthesiaVitals as chartVitals,
  anaesthesiaEvent as chartEvent,
  signAnaesthesia,
  correct as addCorrection,
  reportIncidents,
} from "../generated/anaesthesia_record";
import {
  worklistOtClinical as clinicalWorklist,
  listTypes as listIncidentTypes,
  SurgicalWorklistItemOut,
  IncidentTypeOut,
} from "../generated/safety_checklist";
import {
  getAnaesthesiaRecordScreenView,
  canViewAnaesthesiaRecord,
  canRecordAnaesthesia,
  canCorrectAnaesthesia,
  canReportIncident,
  validatePreInduction,
  validateVitalsEntry,
  validateEventEntry,
  validateRecordSigning,
  validateCorrectionInput,
  validateIncidentInput,
  explainAnaesthesiaRecordError,
  ANAESTHESIA_TECHNIQUES,
  AIRWAY_DEVICES,
  CARDIAC_RHYTHMS,
  EVENT_KINDS,
  ClinicalUser,
} from "../anaesthesia-record-policy";

export interface AnaesthesiaRecordProps {
  establishment?: EstablishmentOut | null;
  currentUser?: ClinicalUser | null;
  connected?: boolean;
  stream?: any;
  timeZone?: string;
  screenId?: string;
  onNavigate?: (screenId: string) => void;
  onNavigateScreen?: (screenId: string) => void;
}

export const AnaesthesiaRecord: React.FC<AnaesthesiaRecordProps> = ({
  establishment,
  currentUser,
  connected = true,
  stream,
  timeZone = "Asia/Karachi",
  screenId = "anaesthesia_record",
  onNavigate,
  onNavigateScreen,
}) => {
  const viewMode = getAnaesthesiaRecordScreenView(establishment, screenId);
  const canView = canViewAnaesthesiaRecord(currentUser);
  const canRecord = canRecordAnaesthesia(currentUser);
  const canCorrect = canCorrectAnaesthesia(currentUser);
  const canReport = canReportIncident(currentUser);

  // Worklist and selection
  const [worklist, setWorklist] = useState<SurgicalWorklistItemOut[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [caseSearch, setCaseSearch] = useState<string>("");

  // Record data
  const [surgicalRecord, setSurgicalRecord] = useState<SurgicalRecordOut | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<{ en: string; ur: string } | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Pre-induction and summary form states
  const [preHr, setPreHr] = useState<string>("");
  const [preBpSys, setPreBpSys] = useState<string>("");
  const [preBpDia, setPreBpDia] = useState<string>("");
  const [preSpo2, setPreSpo2] = useState<string>("");
  const [preFindings, setPreFindings] = useState<string>("");
  const [planChanged, setPlanChanged] = useState<boolean>(false);
  const [planChangeText, setPlanChangeText] = useState<string>("");
  const [technique, setTechnique] = useState<string>("General");
  const [airwayDevice, setAirwayDevice] = useState<string>("EndotrachealTube");
  const [airwayDetails, setAirwayDetails] = useState<string>("");

  // Key timestamps
  const [inductionAt, setInductionAt] = useState<string | null>(null);
  const [incisionAt, setIncisionAt] = useState<string | null>(null);
  const [surgeryEndAt, setSurgeryEndAt] = useState<string | null>(null);
  const [anaesthesiaEndAt, setAnaesthesiaEndAt] = useState<string | null>(null);

  // Summary fields
  const [fluids, setFluids] = useState<string>("");
  const [bloodLoss, setBloodLoss] = useState<string>("");
  const [urineOutput, setUrineOutput] = useState<string>("");
  const [complications, setComplications] = useState<string>("");
  const [handoverNote, setHandoverNote] = useState<string>("");

  // Vitals charting form
  const [vitalHr, setVitalHr] = useState<string>("");
  const [vitalRhythm, setVitalRhythm] = useState<string>("Sinus");
  const [vitalBpSys, setVitalBpSys] = useState<string>("");
  const [vitalBpDia, setVitalBpDia] = useState<string>("");
  const [vitalRr, setVitalRr] = useState<string>("");
  const [vitalSpo2, setVitalSpo2] = useState<string>("99");
  const [vitalEtco2, setVitalEtco2] = useState<string>("");
  const [vitalTemp, setVitalTemp] = useState<string>("");
  const [vitalAirwayPatent, setVitalAirwayPatent] = useState<boolean>(true);
  const [vitalNote, setVitalNote] = useState<string>("");

  // Events charting form
  const [eventKind, setEventKind] = useState<"Drug" | "Fluid" | "Blood" | "Event">("Drug");
  const [eventDesc, setEventDesc] = useState<string>("");
  const [eventDose, setEventDose] = useState<string>("");
  const [eventRoute, setEventRoute] = useState<string>("IV");

  // Modals
  const [showCorrectionModal, setShowCorrectionModal] = useState<boolean>(false);
  const [corrText, setCorrText] = useState<string>("");
  const [corrReason, setCorrReason] = useState<string>("");

  const [showIncidentModal, setShowIncidentModal] = useState<boolean>(false);
  const [incidentTypesList, setIncidentTypesList] = useState<IncidentTypeOut[]>([]);
  const [selectedIncidentTypeCode, setSelectedIncidentTypeCode] = useState<string>("");
  const [incidentSummary, setIncidentSummary] = useState<string>("");

  // Validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Active anaesthesia record
  const anaesthesia = surgicalRecord?.anaesthesia_record;
  const isFinal = anaesthesia?.status === "Final";
  const isReadonly = isFinal || viewMode === "records" || !canRecord;

  // Load candidate worklist
  const loadWorklist = useCallback(async () => {
    try {
      setLoading(true);
      setErrorBanner(null);
      const data = await clinicalWorklist({ days: 7 });
      setWorklist(data);
      if (data.length > 0 && selectedBookingId === null) {
        setSelectedBookingId(data[0].booking_id);
      }
    } catch (err: any) {
      setErrorBanner(explainAnaesthesiaRecordError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  }, [selectedBookingId]);

  // Load record details for selected booking
  const loadRecord = useCallback(async (bookingId: number) => {
    try {
      setLoading(true);
      setErrorBanner(null);
      const rec = await getSurgicalRecord(bookingId);
      setSurgicalRecord(rec);

      const ar = rec.anaesthesia_record;
      if (ar) {
        setPreHr(ar.pre_induction_heart_rate !== null ? String(ar.pre_induction_heart_rate) : "");
        setPreBpSys(ar.pre_induction_bp_systolic !== null ? String(ar.pre_induction_bp_systolic) : "");
        setPreBpDia(ar.pre_induction_bp_diastolic !== null ? String(ar.pre_induction_bp_diastolic) : "");
        setPreSpo2(ar.pre_induction_spo2 !== null ? String(ar.pre_induction_spo2) : "");
        setPreFindings(ar.pre_induction_findings || "");
        setPlanChanged(Boolean(ar.plan_changed));
        setPlanChangeText(ar.plan_change || "");
        setTechnique(ar.technique || "General");
        setAirwayDevice(ar.airway_device || "EndotrachealTube");
        setAirwayDetails(ar.airway_details || "");

        setInductionAt(ar.induction_at);
        setIncisionAt(ar.incision_at);
        setSurgeryEndAt(ar.surgery_end_at);
        setAnaesthesiaEndAt(ar.anaesthesia_end_at);

        setFluids(ar.fluids || "");
        setBloodLoss(ar.blood_loss_ml !== null ? String(ar.blood_loss_ml) : "");
        setUrineOutput(ar.urine_output_ml !== null ? String(ar.urine_output_ml) : "");
        setComplications(ar.complications || "");
        setHandoverNote(ar.handover_note || "");
      } else {
        // Clear forms for fresh draft
        setPreHr("");
        setPreBpSys("");
        setPreBpDia("");
        setPreSpo2("");
        setPreFindings("");
        setPlanChanged(false);
        setPlanChangeText("");
        setTechnique("General");
        setAirwayDevice("EndotrachealTube");
        setAirwayDetails("");
        setInductionAt(null);
        setIncisionAt(null);
        setSurgeryEndAt(null);
        setAnaesthesiaEndAt(null);
        setFluids("");
        setBloodLoss("");
        setUrineOutput("");
        setComplications("");
        setHandoverNote("");
      }
    } catch (err: any) {
      setErrorBanner(explainAnaesthesiaRecordError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadWorklist();
  }, [loadWorklist]);

  // Load record when selectedBookingId changes
  useEffect(() => {
    if (selectedBookingId) {
      loadRecord(selectedBookingId);
    }
  }, [selectedBookingId, loadRecord]);

  // Load incident types when modal opens
  useEffect(() => {
    if (showIncidentModal && incidentTypesList.length === 0) {
      listIncidentTypes({ area: "Anaesthesia", active_only: true })
        .then((types) => {
          setIncidentTypesList(types);
          if (types.length > 0) {
            setSelectedIncidentTypeCode(types[0].type_code);
          }
        })
        .catch(() => {});
    }
  }, [showIncidentModal, incidentTypesList.length]);

  // WebSocket realtime update handler
  useEffect(() => {
    if (!stream) return;
    try {
      const parsed = typeof stream === "string" ? JSON.parse(stream) : stream;
      if (parsed.event === "ot.clinical.updated") {
        if (selectedBookingId) {
          loadRecord(selectedBookingId);
        }
        loadWorklist();
      }
    } catch {
      // Ignore non-json socket messages
    }
  }, [stream, selectedBookingId, loadRecord, loadWorklist]);

  // Filtered cases list
  const filteredWorklist = useMemo(() => {
    if (!caseSearch.trim()) return worklist;
    const q = caseSearch.toLowerCase();
    return worklist.filter(
      (w) =>
        w.patient_name.toLowerCase().includes(q) ||
        w.mrn.toLowerCase().includes(q) ||
        w.procedure_name.toLowerCase().includes(q) ||
        w.booking_number.toLowerCase().includes(q)
    );
  }, [worklist, caseSearch]);

  // Save Pre-Induction & Plan Draft
  const handleSavePreInduction = async () => {
    if (!selectedBookingId || isReadonly) return;
    setFormErrors({});

    const body: AnaesthesiaRecordIn = {
      pre_induction_heart_rate: preHr ? Number(preHr) : null,
      pre_induction_bp_systolic: preBpSys ? Number(preBpSys) : null,
      pre_induction_bp_diastolic: preBpDia ? Number(preBpDia) : null,
      pre_induction_spo2: preSpo2 ? Number(preSpo2) : null,
      pre_induction_findings: preFindings.trim() || null,
      plan_changed: planChanged,
      plan_change: planChanged ? planChangeText.trim() : null,
      technique: technique as any,
      airway_device: airwayDevice as any,
      airway_details: airwayDetails.trim() || null,
      expected_version: anaesthesia?.row_version,
    };

    const val = validatePreInduction(body);
    if (!val.valid) {
      setFormErrors(val.errors);
      return;
    }

    try {
      setSubmitting(true);
      setErrorBanner(null);
      const updated = await updateAnaesthesiaRecord(selectedBookingId, body);
      setSurgicalRecord(updated);
      setSuccessBanner("Pre-induction evaluation saved successfully.");
      setTimeout(() => setSuccessBanner(null), 3000);
    } catch (err: any) {
      setErrorBanner(explainAnaesthesiaRecordError(err?.code, err?.details));
    } finally {
      setSubmitting(false);
    }
  };

  // Stamp Time Button Handler
  const handleStampTime = async (field: "induction" | "incision" | "surgery_end" | "anaesthesia_end") => {
    if (!selectedBookingId || isReadonly) return;
    const nowIso = new Date().toISOString();

    const body: AnaesthesiaRecordIn = {
      expected_version: anaesthesia?.row_version,
    };

    if (field === "induction") {
      body.induction_at = nowIso;
      setInductionAt(nowIso);
    } else if (field === "incision") {
      body.incision_at = nowIso;
      setIncisionAt(nowIso);
    } else if (field === "surgery_end") {
      body.surgery_end_at = nowIso;
      setSurgeryEndAt(nowIso);
    } else if (field === "anaesthesia_end") {
      body.anaesthesia_end_at = nowIso;
      setAnaesthesiaEndAt(nowIso);
    }

    try {
      setSubmitting(true);
      setErrorBanner(null);
      const updated = await updateAnaesthesiaRecord(selectedBookingId, body);
      setSurgicalRecord(updated);
    } catch (err: any) {
      setErrorBanner(explainAnaesthesiaRecordError(err?.code, err?.details));
    } finally {
      setSubmitting(false);
    }
  };

  // Chart Vitals Entry
  const handleChartVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingId || isReadonly) return;
    setFormErrors({});

    const body: AnaesthesiaVitalsIn = {
      heart_rate: Number(vitalHr),
      rhythm: vitalRhythm as any,
      bp_systolic: Number(vitalBpSys),
      bp_diastolic: Number(vitalBpDia),
      respiratory_rate: Number(vitalRr),
      spo2: Number(vitalSpo2),
      etco2: vitalEtco2 ? Number(vitalEtco2) : null,
      temp_c: vitalTemp ? Number(vitalTemp) : null,
      airway_patent: vitalAirwayPatent,
      note: vitalNote.trim() || null,
    };

    const val = validateVitalsEntry(body);
    if (!val.valid) {
      setFormErrors(val.errors);
      return;
    }

    try {
      setSubmitting(true);
      setErrorBanner(null);
      const updated = await chartVitals(selectedBookingId, body);
      setSurgicalRecord(updated);
      setSuccessBanner("Vital signs reading charted successfully.");
      setTimeout(() => setSuccessBanner(null), 3000);
      setVitalNote("");
    } catch (err: any) {
      setErrorBanner(explainAnaesthesiaRecordError(err?.code, err?.details));
    } finally {
      setSubmitting(false);
    }
  };

  // Chart Event / Drug Entry
  const handleChartEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingId || isReadonly) return;
    setFormErrors({});

    const body: AnaesthesiaEventIn = {
      kind: eventKind,
      description: eventDesc.trim(),
      dose: eventDose.trim() || null,
      route: eventRoute.trim() || null,
    };

    const val = validateEventEntry(body);
    if (!val.valid) {
      setFormErrors(val.errors);
      return;
    }

    try {
      setSubmitting(true);
      setErrorBanner(null);
      const updated = await chartEvent(selectedBookingId, body);
      setSurgicalRecord(updated);
      setSuccessBanner(`${eventKind} recorded successfully.`);
      setTimeout(() => setSuccessBanner(null), 3000);
      setEventDesc("");
      setEventDose("");
    } catch (err: any) {
      setErrorBanner(explainAnaesthesiaRecordError(err?.code, err?.details));
    } finally {
      setSubmitting(false);
    }
  };

  // Save Post-Procedure Summary
  const handleSaveSummary = async () => {
    if (!selectedBookingId || isReadonly) return;

    const body: AnaesthesiaRecordIn = {
      fluids: fluids.trim() || null,
      blood_loss_ml: bloodLoss ? Number(bloodLoss) : null,
      urine_output_ml: urineOutput ? Number(urineOutput) : null,
      complications: complications.trim() || null,
      handover_note: handoverNote.trim() || null,
      expected_version: anaesthesia?.row_version,
    };

    try {
      setSubmitting(true);
      setErrorBanner(null);
      const updated = await updateAnaesthesiaRecord(selectedBookingId, body);
      setSurgicalRecord(updated);
      setSuccessBanner("Summary and recovery handover saved.");
      setTimeout(() => setSuccessBanner(null), 3000);
    } catch (err: any) {
      setErrorBanner(explainAnaesthesiaRecordError(err?.code, err?.details));
    } finally {
      setSubmitting(false);
    }
  };

  // Sign Record
  const handleSignRecord = async () => {
    if (!selectedBookingId || isReadonly) return;

    const draftState: Partial<AnaesthesiaRecordIn> = {
      induction_at: inductionAt,
      incision_at: incisionAt,
      anaesthesia_end_at: anaesthesiaEndAt,
      technique: technique as any,
      airway_device: airwayDevice as any,
      handover_note: handoverNote,
    };

    const signCheck = validateRecordSigning(anaesthesia, draftState);
    if (!signCheck.canSign) {
      setErrorBanner({
        en: `Cannot sign record. Missing: ${signCheck.missing.join(", ")}`,
        ur: `ریکارڈ پر دستخط ممکن نہیں۔ درج ذیل اندراجات لازمی ہیں: ${signCheck.missing.join("، ")}`,
      });
      return;
    }

    try {
      setSubmitting(true);
      setErrorBanner(null);
      const updated = await signAnaesthesia(selectedBookingId, {
        expected_version: anaesthesia?.row_version,
      });
      setSurgicalRecord(updated);
      setSuccessBanner("Anaesthesia record signed and finalized.");
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err: any) {
      setErrorBanner(explainAnaesthesiaRecordError(err?.code, err?.details));
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Correction Addendum
  const handleAddCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingId) return;

    const corrData: SurgicalCorrectionIn = {
      record: "AnaesthesiaRecord",
      correction_text: corrText.trim(),
      correction_reason: corrReason.trim(),
    };

    const val = validateCorrectionInput(corrData);
    if (!val.valid) {
      setFormErrors(val.errors);
      return;
    }

    try {
      setSubmitting(true);
      setErrorBanner(null);
      const updated = await addCorrection(selectedBookingId, corrData);
      setSurgicalRecord(updated);
      setShowCorrectionModal(false);
      setCorrText("");
      setCorrReason("");
      setSuccessBanner("Correction addendum appended successfully.");
      setTimeout(() => setSuccessBanner(null), 3000);
    } catch (err: any) {
      setErrorBanner(explainAnaesthesiaRecordError(err?.code, err?.details));
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Incident / Adverse Event
  const handleSubmitIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingId) return;

    const incidentData: IncidentIn = {
      booking_id: selectedBookingId,
      type_code: selectedIncidentTypeCode,
      description: incidentSummary.trim(),
      immediate_action: "Immediate corrective action documented in theatre.",
      occurred_at: new Date().toISOString(),
      affected: "Patient",
      ot_phase: "Maintenance",
    };

    const val = validateIncidentInput(incidentData);
    if (!val.valid) {
      setFormErrors(val.errors);
      return;
    }

    try {
      setSubmitting(true);
      setErrorBanner(null);
      await reportIncidents(incidentData);
      setShowIncidentModal(false);
      setIncidentSummary("");
      setSuccessBanner("Adverse incident reported to hospital quality assurance.");
      setTimeout(() => setSuccessBanner(null), 3000);
      loadRecord(selectedBookingId);
    } catch (err: any) {
      setErrorBanner(explainAnaesthesiaRecordError(err?.code, err?.details));
    } finally {
      setSubmitting(false);
    }
  };

  if (viewMode === "hidden") {
    return (
      <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
        <h2 className="text-xl font-bold">Anaesthesia Record Unavailable</h2>
        <p>The surgery service is currently inactive or hidden in this facility configuration.</p>
      </div>
    );
  }

  const booking = surgicalRecord?.booking;

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6">
      {/* Capability View Mode Banner */}
      {viewMode === "open_work" && (
        <div className="p-3 bg-amber-100 border border-amber-300 text-amber-900 rounded-md">
          <span className="font-semibold">Notice:</span> No new surgical cases from now on. Completing open work only.
        </div>
      )}
      {viewMode === "records" && (
        <div className="p-3 bg-blue-100 border border-blue-300 text-blue-900 rounded-md">
          <span className="font-semibold">Read-only Records View:</span> Service is retiring. You may view historical records and append statutory corrections only.
        </div>
      )}

      {/* Header and Case Selection */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Anaesthesia Record & Flowsheet</h1>
          <p className="text-sm text-gray-600">
            Intra-operative monitoring, pre-induction evaluation, drug administration, and recovery handover (MSDS COP 34, 36, 37, 40).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search cases (name, MRN, procedure)..."
            value={caseSearch}
            onChange={(e) => setCaseSearch(e.target.value)}
            className="px-3 py-1.5 border rounded-md text-sm w-64"
            data-help="anaesthesia_record.case_search"
          />

          <select
            value={selectedBookingId || ""}
            onChange={(e) => setSelectedBookingId(Number(e.target.value))}
            className="px-3 py-1.5 border rounded-md text-sm bg-white"
            data-help="anaesthesia_record.case_select"
          >
            {filteredWorklist.length === 0 ? (
              <option value="">No active surgical cases</option>
            ) : (
              filteredWorklist.map((c) => (
                <option key={c.booking_id} value={c.booking_id}>
                  {c.booking_number} - {c.patient_name} ({c.mrn}) [{c.status}]
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Notifications */}
      {errorBanner && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 space-y-1">
          <div className="font-semibold">{errorBanner.en}</div>
          <div className="text-sm text-red-700 font-urdu">{errorBanner.ur}</div>
        </div>
      )}
      {successBanner && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-800 font-medium">
          {successBanner}
        </div>
      )}

      {/* Patient & Surgical Case Banner */}
      {booking && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
          <div>
            <span className="text-gray-500 block text-xs">Patient Name</span>
            <span className="font-bold text-gray-900">{booking.patient_name}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs">MRN & Demographics</span>
            <span className="font-mono">{booking.mrn}</span> {booking.gender} {booking.age_years}y
          </div>
          <div>
            <span className="text-gray-500 block text-xs">Procedure</span>
            <span className="font-medium text-indigo-700">{booking.procedure_name}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs">Theatre Room</span>
            <span>{booking.ot_name || "Main OT"}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs">Primary Surgeon</span>
            <span>{booking.surgeon_name}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs">Record Status</span>
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                isFinal ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
              }`}
            >
              {anaesthesia?.status || "Draft"}
            </span>
          </div>
        </div>
      )}

      {/* Chart Gaps Warning Banner (Rule c7bd8c2650) */}
      {anaesthesia && anaesthesia.chart_gaps && anaesthesia.chart_gaps.length > 0 && (
        <div className="p-4 bg-amber-50 border-l-4 border-amber-500 rounded-md text-amber-900">
          <div className="font-bold flex items-center gap-2">
            <span>⚠️ Monitoring Chart Gap Detected</span>
          </div>
          <div className="text-sm mt-1">
            Readings are further apart than hospital standard policy. Please chart patient vitals immediately:
            <ul className="list-disc ml-5 mt-1">
              {anaesthesia.chart_gaps.map((g, idx) => (
                <li key={idx}>
                  Gap from {new Date(g.from_at).toLocaleTimeString()} to {new Date(g.to_at).toLocaleTimeString()} ({g.minutes} minutes)
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Main Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (1 col): Pre-Induction & Operative Times */}
        <div className="space-y-6">
          {/* Pre-Induction Panel (Rule eda7089766) */}
          <div className="bg-white border rounded-lg p-4 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-2">Pre-Induction Evaluation</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700">Baseline HR (bpm)</label>
                <input
                  type="number"
                  value={preHr}
                  onChange={(e) => setPreHr(e.target.value)}
                  disabled={isReadonly}
                  className="w-full px-2.5 py-1.5 border rounded text-sm mt-1"
                  data-help="anaesthesia_record.pre_hr"
                />
                {formErrors.pre_induction_heart_rate && (
                  <p className="text-xs text-red-600 mt-0.5">{formErrors.pre_induction_heart_rate}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Baseline SpO2 (%)</label>
                <input
                  type="number"
                  value={preSpo2}
                  onChange={(e) => setPreSpo2(e.target.value)}
                  disabled={isReadonly}
                  className="w-full px-2.5 py-1.5 border rounded text-sm mt-1"
                  data-help="anaesthesia_record.pre_spo2"
                />
                {formErrors.pre_induction_spo2 && (
                  <p className="text-xs text-red-600 mt-0.5">{formErrors.pre_induction_spo2}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Systolic BP (mmHg)</label>
                <input
                  type="number"
                  value={preBpSys}
                  onChange={(e) => setPreBpSys(e.target.value)}
                  disabled={isReadonly}
                  className="w-full px-2.5 py-1.5 border rounded text-sm mt-1"
                  data-help="anaesthesia_record.pre_bp_sys"
                />
                {formErrors.pre_induction_bp_systolic && (
                  <p className="text-xs text-red-600 mt-0.5">{formErrors.pre_induction_bp_systolic}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Diastolic BP (mmHg)</label>
                <input
                  type="number"
                  value={preBpDia}
                  onChange={(e) => setPreBpDia(e.target.value)}
                  disabled={isReadonly}
                  className="w-full px-2.5 py-1.5 border rounded text-sm mt-1"
                  data-help="anaesthesia_record.pre_bp_dia"
                />
                {formErrors.pre_induction_bp_diastolic && (
                  <p className="text-xs text-red-600 mt-0.5">{formErrors.pre_induction_bp_diastolic}</p>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700">Clinical Findings Since PAC</label>
              <textarea
                value={preFindings}
                onChange={(e) => setPreFindings(e.target.value)}
                disabled={isReadonly}
                rows={2}
                placeholder="Airway re-examination, fasting status, acute changes..."
                className="w-full px-2.5 py-1.5 border rounded text-sm mt-1"
                data-help="anaesthesia_record.pre_findings"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={planChanged}
                  onChange={(e) => setPlanChanged(e.target.checked)}
                  disabled={isReadonly}
                  className="rounded text-indigo-600"
                  data-help="anaesthesia_record.plan_changed"
                />
                <span>Anaesthesia plan changed since assessment</span>
              </label>

              {planChanged && (
                <div>
                  <textarea
                    value={planChangeText}
                    onChange={(e) => setPlanChangeText(e.target.value)}
                    disabled={isReadonly}
                    rows={2}
                    placeholder="Mandatory clinical rationale for change of plan..."
                    className="w-full px-2.5 py-1.5 border rounded text-sm"
                    data-help="anaesthesia_record.plan_change_text"
                  />
                  {formErrors.plan_change && (
                    <p className="text-xs text-red-600 mt-0.5">{formErrors.plan_change}</p>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700">Technique</label>
                <select
                  value={technique}
                  onChange={(e) => setTechnique(e.target.value)}
                  disabled={isReadonly}
                  className="w-full px-2.5 py-1.5 border rounded text-sm mt-1 bg-white"
                  data-help="anaesthesia_record.technique"
                >
                  {ANAESTHESIA_TECHNIQUES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Airway Device</label>
                <select
                  value={airwayDevice}
                  onChange={(e) => setAirwayDevice(e.target.value)}
                  disabled={isReadonly}
                  className="w-full px-2.5 py-1.5 border rounded text-sm mt-1 bg-white"
                  data-help="anaesthesia_record.airway_device"
                >
                  {AIRWAY_DEVICES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700">Airway & Intubation Details</label>
              <input
                type="text"
                value={airwayDetails}
                onChange={(e) => setAirwayDetails(e.target.value)}
                disabled={isReadonly}
                placeholder="ETT size, cuffed, Cormack-Lehane grade, blade..."
                className="w-full px-2.5 py-1.5 border rounded text-sm mt-1"
                data-help="anaesthesia_record.airway_details"
              />
            </div>

            <button
              type="button"
              onClick={handleSavePreInduction}
              disabled={isReadonly || submitting}
              className="w-full py-2 bg-slate-800 text-white rounded text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
              data-help="anaesthesia_record.save_pre_induction"
            >
              Save Pre-Induction Evaluation
            </button>
          </div>

          {/* Operative Key Times Actions (Rule eda7089766) */}
          <div className="bg-white border rounded-lg p-4 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-2">Operative Time Stamps</h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium block">Induction</span>
                  <span className="text-xs text-gray-500">
                    {inductionAt ? new Date(inductionAt).toLocaleTimeString() : "Not stamped (Sign In required)"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleStampTime("induction")}
                  disabled={isReadonly || submitting || Boolean(inductionAt)}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
                  data-help="anaesthesia_record.stamp_induction"
                >
                  Stamp Induction
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium block">Incision</span>
                  <span className="text-xs text-gray-500">
                    {incisionAt ? new Date(incisionAt).toLocaleTimeString() : "Not stamped (Time Out required)"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleStampTime("incision")}
                  disabled={isReadonly || submitting || Boolean(incisionAt)}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
                  data-help="anaesthesia_record.stamp_incision"
                >
                  Stamp Incision
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium block">Surgery End</span>
                  <span className="text-xs text-gray-500">
                    {surgeryEndAt ? new Date(surgeryEndAt).toLocaleTimeString() : "Not stamped"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleStampTime("surgery_end")}
                  disabled={isReadonly || submitting || Boolean(surgeryEndAt)}
                  className="px-3 py-1.5 bg-slate-700 text-white rounded text-xs font-medium hover:bg-slate-600 disabled:opacity-50"
                  data-help="anaesthesia_record.stamp_surgery_end"
                >
                  Stamp Surgery End
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium block">Anaesthesia End</span>
                  <span className="text-xs text-gray-500">
                    {anaesthesiaEndAt ? new Date(anaesthesiaEndAt).toLocaleTimeString() : "Not stamped"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleStampTime("anaesthesia_end")}
                  disabled={isReadonly || submitting || Boolean(anaesthesiaEndAt)}
                  className="px-3 py-1.5 bg-slate-700 text-white rounded text-xs font-medium hover:bg-slate-600 disabled:opacity-50"
                  data-help="anaesthesia_record.stamp_anaesthesia_end"
                >
                  Stamp Anaesthesia End
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions & Modals */}
          <div className="bg-white border rounded-lg p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Statutory Audit Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowIncidentModal(true)}
                disabled={!canReport}
                className="py-2 px-3 border border-red-300 bg-red-50 text-red-700 rounded text-xs font-medium hover:bg-red-100 disabled:opacity-50"
                data-help="anaesthesia_record.open_incident_btn"
              >
                Report Adverse Incident
              </button>

              <button
                type="button"
                onClick={() => setShowCorrectionModal(true)}
                disabled={!isFinal || !canCorrect}
                className="py-2 px-3 border border-amber-300 bg-amber-50 text-amber-800 rounded text-xs font-medium hover:bg-amber-100 disabled:opacity-50"
                data-help="anaesthesia_record.open_correction_btn"
              >
                Add Correction Addendum
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (2 cols): Monitoring Flowsheet, Events, Summary & Sign */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vitals Flowsheet Form & Table (Rule c7bd8c2650, MSDS 36) */}
          <div className="bg-white border rounded-lg p-4 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-2">Periodic Vitals Charting</h2>

            <form onSubmit={handleChartVitals} className="space-y-3 bg-slate-50 p-3 rounded-md border">
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-700">HR (bpm) *</label>
                  <input
                    type="number"
                    value={vitalHr}
                    onChange={(e) => setVitalHr(e.target.value)}
                    disabled={isReadonly}
                    className="w-full px-2 py-1 border rounded text-sm mt-1"
                    data-help="anaesthesia_record.vital_hr"
                  />
                  {formErrors.heart_rate && <p className="text-xs text-red-600">{formErrors.heart_rate}</p>}
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700">Rhythm</label>
                  <select
                    value={vitalRhythm}
                    onChange={(e) => setVitalRhythm(e.target.value)}
                    disabled={isReadonly}
                    className="w-full px-2 py-1 border rounded text-sm mt-1 bg-white"
                    data-help="anaesthesia_record.vital_rhythm"
                  >
                    {CARDIAC_RHYTHMS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700">Sys BP *</label>
                  <input
                    type="number"
                    value={vitalBpSys}
                    onChange={(e) => setVitalBpSys(e.target.value)}
                    disabled={isReadonly}
                    className="w-full px-2 py-1 border rounded text-sm mt-1"
                    data-help="anaesthesia_record.vital_bp_sys"
                  />
                  {formErrors.bp_systolic && <p className="text-xs text-red-600">{formErrors.bp_systolic}</p>}
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700">Dia BP *</label>
                  <input
                    type="number"
                    value={vitalBpDia}
                    onChange={(e) => setVitalBpDia(e.target.value)}
                    disabled={isReadonly}
                    className="w-full px-2 py-1 border rounded text-sm mt-1"
                    data-help="anaesthesia_record.vital_bp_dia"
                  />
                  {formErrors.bp_diastolic && <p className="text-xs text-red-600">{formErrors.bp_diastolic}</p>}
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700">RR (/min) *</label>
                  <input
                    type="number"
                    value={vitalRr}
                    onChange={(e) => setVitalRr(e.target.value)}
                    disabled={isReadonly}
                    className="w-full px-2 py-1 border rounded text-sm mt-1"
                    data-help="anaesthesia_record.vital_rr"
                  />
                  {formErrors.respiratory_rate && <p className="text-xs text-red-600">{formErrors.respiratory_rate}</p>}
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700">SpO2 (%) *</label>
                  <input
                    type="number"
                    value={vitalSpo2}
                    onChange={(e) => setVitalSpo2(e.target.value)}
                    disabled={isReadonly}
                    className="w-full px-2 py-1 border rounded text-sm mt-1"
                    data-help="anaesthesia_record.vital_spo2"
                  />
                  {formErrors.spo2 && <p className="text-xs text-red-600">{formErrors.spo2}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-700">EtCO2 (mmHg)</label>
                  <input
                    type="number"
                    value={vitalEtco2}
                    onChange={(e) => setVitalEtco2(e.target.value)}
                    disabled={isReadonly}
                    className="w-full px-2 py-1 border rounded text-sm mt-1"
                    data-help="anaesthesia_record.vital_etco2"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700">Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={vitalTemp}
                    onChange={(e) => setVitalTemp(e.target.value)}
                    disabled={isReadonly}
                    className="w-full px-2 py-1 border rounded text-sm mt-1"
                    data-help="anaesthesia_record.vital_temp"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={vitalAirwayPatent}
                      onChange={(e) => setVitalAirwayPatent(e.target.checked)}
                      disabled={isReadonly}
                      className="rounded text-indigo-600"
                      data-help="anaesthesia_record.vital_airway_patent"
                    />
                    <span>Airway Patent</span>
                  </label>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700">Clinical Note</label>
                  <input
                    type="text"
                    value={vitalNote}
                    onChange={(e) => setVitalNote(e.target.value)}
                    disabled={isReadonly}
                    placeholder="Trend, position, suction..."
                    className="w-full px-2 py-1 border rounded text-sm mt-1"
                    data-help="anaesthesia_record.vital_note"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isReadonly || submitting}
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                  data-help="anaesthesia_record.chart_vitals_btn"
                >
                  Record Vitals Reading
                </button>
              </div>
            </form>

            {/* Vitals History Table */}
            <div className="overflow-x-auto border rounded-md">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-700 border-b">
                  <tr>
                    <th className="p-2">Time</th>
                    <th className="p-2">HR</th>
                    <th className="p-2">Rhythm</th>
                    <th className="p-2">BP</th>
                    <th className="p-2">RR</th>
                    <th className="p-2">SpO2</th>
                    <th className="p-2">EtCO2</th>
                    <th className="p-2">Temp</th>
                    <th className="p-2">Airway</th>
                    <th className="p-2">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {anaesthesia?.vitals && anaesthesia.vitals.length > 0 ? (
                    anaesthesia.vitals.map((v) => (
                      <tr key={v.vital_id} className="hover:bg-gray-50">
                        <td className="p-2 font-mono">{new Date(v.recorded_at).toLocaleTimeString()}</td>
                        <td className="p-2 font-bold">{v.heart_rate}</td>
                        <td className="p-2">{v.rhythm}</td>
                        <td className="p-2 font-mono">
                          {v.bp_systolic}/{v.bp_diastolic}
                        </td>
                        <td className="p-2">{v.respiratory_rate}</td>
                        <td className="p-2">{v.spo2}%</td>
                        <td className="p-2">{v.etco2 ?? "-"}</td>
                        <td className="p-2">{v.temp_c ? `${v.temp_c}°C` : "-"}</td>
                        <td className="p-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              v.airway_patent ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }`}
                          >
                            {v.airway_patent ? "Patent" : "Obstructed"}
                          </span>
                        </td>
                        <td className="p-2 text-gray-500">{v.recorded_by_name}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="p-3 text-center text-gray-500">
                        No intra-operative vital signs recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Drugs, Fluids, Blood & Events Flowsheet (Rule c7bd8c2650) */}
          <div className="bg-white border rounded-lg p-4 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-2">Drugs, Fluids & Intra-operative Events</h2>

            <form onSubmit={handleChartEvent} className="bg-slate-50 p-3 rounded-md border space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-700">Category *</label>
                  <select
                    value={eventKind}
                    onChange={(e) => setEventKind(e.target.value as any)}
                    disabled={isReadonly}
                    className="w-full px-2 py-1.5 border rounded text-sm mt-1 bg-white"
                    data-help="anaesthesia_record.event_kind"
                  >
                    {EVENT_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-700">Description / Drug *</label>
                  <input
                    type="text"
                    value={eventDesc}
                    onChange={(e) => setEventDesc(e.target.value)}
                    disabled={isReadonly}
                    placeholder="e.g. Propofol, Ringer Lactate, Packed RBCs..."
                    className="w-full px-2 py-1.5 border rounded text-sm mt-1"
                    data-help="anaesthesia_record.event_desc"
                  />
                  {formErrors.description && <p className="text-xs text-red-600">{formErrors.description}</p>}
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700">Dose / Volume</label>
                  <input
                    type="text"
                    value={eventDose}
                    onChange={(e) => setEventDose(e.target.value)}
                    disabled={isReadonly}
                    placeholder="e.g. 150 mg, 500 ml"
                    className="w-full px-2 py-1.5 border rounded text-sm mt-1"
                    data-help="anaesthesia_record.event_dose"
                  />
                  {formErrors.dose && <p className="text-xs text-red-600">{formErrors.dose}</p>}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="w-1/3">
                  <label className="text-xs font-medium text-gray-700">Route</label>
                  <input
                    type="text"
                    value={eventRoute}
                    onChange={(e) => setEventRoute(e.target.value)}
                    disabled={isReadonly}
                    placeholder="IV, Inhaled, Epidural..."
                    className="w-full px-2 py-1 border rounded text-sm"
                    data-help="anaesthesia_record.event_route"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isReadonly || submitting}
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                  data-help="anaesthesia_record.chart_event_btn"
                >
                  Record {eventKind}
                </button>
              </div>
            </form>

            {/* Events History Table */}
            <div className="overflow-x-auto border rounded-md">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-700 border-b">
                  <tr>
                    <th className="p-2">Time</th>
                    <th className="p-2">Category</th>
                    <th className="p-2">Description</th>
                    <th className="p-2">Dose</th>
                    <th className="p-2">Route</th>
                    <th className="p-2">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {anaesthesia?.events && anaesthesia.events.length > 0 ? (
                    anaesthesia.events.map((ev) => (
                      <tr key={ev.entry_id} className="hover:bg-gray-50">
                        <td className="p-2 font-mono">{new Date(ev.at).toLocaleTimeString()}</td>
                        <td className="p-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              ev.kind === "Drug"
                                ? "bg-purple-100 text-purple-800"
                                : ev.kind === "Fluid"
                                ? "bg-blue-100 text-blue-800"
                                : ev.kind === "Blood"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {ev.kind}
                          </span>
                        </td>
                        <td className="p-2 font-medium">{ev.description}</td>
                        <td className="p-2 font-mono">{ev.dose || "-"}</td>
                        <td className="p-2">{ev.route || "-"}</td>
                        <td className="p-2 text-gray-500">{ev.recorded_by_name}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-3 text-center text-gray-500">
                        No intra-operative drugs or fluids charted yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Post-Procedure Summary & Recovery Handover (Rule 2fc0c843dc) */}
          <div className="bg-white border rounded-lg p-4 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-2">
              Post-Procedure Summary & Recovery Handover
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700">Total Fluids Administered</label>
                <input
                  type="text"
                  value={fluids}
                  onChange={(e) => setFluids(e.target.value)}
                  disabled={isReadonly}
                  placeholder="e.g. RL 1500ml, DNS 500ml"
                  className="w-full px-2.5 py-1.5 border rounded text-sm mt-1"
                  data-help="anaesthesia_record.fluids"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Estimated Blood Loss (ml)</label>
                <input
                  type="number"
                  value={bloodLoss}
                  onChange={(e) => setBloodLoss(e.target.value)}
                  disabled={isReadonly}
                  placeholder="e.g. 250"
                  className="w-full px-2.5 py-1.5 border rounded text-sm mt-1"
                  data-help="anaesthesia_record.blood_loss"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Urine Output (ml)</label>
                <input
                  type="number"
                  value={urineOutput}
                  onChange={(e) => setUrineOutput(e.target.value)}
                  disabled={isReadonly}
                  placeholder="e.g. 400"
                  className="w-full px-2.5 py-1.5 border rounded text-sm mt-1"
                  data-help="anaesthesia_record.urine_output"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700">Complications / Critical Events</label>
              <textarea
                value={complications}
                onChange={(e) => setComplications(e.target.value)}
                disabled={isReadonly}
                rows={2}
                placeholder="Airway difficulties, hypotension, arrhythmias, blood loss >= 500ml..."
                className="w-full px-2.5 py-1.5 border rounded text-sm mt-1"
                data-help="anaesthesia_record.complications"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700">Recovery Handover Note *</label>
              <textarea
                value={handoverNote}
                onChange={(e) => setHandoverNote(e.target.value)}
                disabled={isReadonly}
                rows={3}
                placeholder="Airway stability, post-op analgesic plan, oxygen therapy, PACU discharge criteria..."
                className="w-full px-2.5 py-1.5 border rounded text-sm mt-1"
                data-help="anaesthesia_record.handover_note"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleSaveSummary}
                disabled={isReadonly || submitting}
                className="px-4 py-2 bg-slate-800 text-white rounded text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
                data-help="anaesthesia_record.save_summary_btn"
              >
                Save Handover Draft
              </button>

              <button
                type="button"
                onClick={handleSignRecord}
                disabled={isFinal || !canRecord || submitting}
                className="px-6 py-2 bg-green-600 text-white rounded text-sm font-bold hover:bg-green-700 disabled:opacity-50"
                data-help="anaesthesia_record.sign_record_btn"
              >
                {isFinal ? "Record Signed (Final)" : "Sign Anaesthesia Record"}
              </button>
            </div>
          </div>

          {/* Corrections Ledger (Rule 9e9cb593cb) */}
          {surgicalRecord?.corrections && surgicalRecord.corrections.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-bold text-amber-900">Post-Finality Corrections Ledger</h3>
              <div className="space-y-2">
                {surgicalRecord.corrections
                  .filter((c) => c.record === "AnaesthesiaRecord")
                  .map((c) => (
                    <div key={c.correction_id} className="p-2 bg-white rounded border border-amber-200 text-xs">
                      <div className="font-semibold text-gray-900">{c.correction_text}</div>
                      <div className="text-gray-600 mt-0.5">
                        <span className="font-medium">Reason:</span> {c.correction_reason} |{" "}
                        <span className="text-gray-500">By {c.author_stamp.name} on {new Date(c.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Correction Addendum Modal (Rule 9e9cb593cb) */}
      {showCorrectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Append Correction Addendum</h2>
            <p className="text-xs text-gray-600">
              Signed anaesthesia records are legally final (OT_RECORD_FINAL). Statutory audits require an explanatory reason for any retrospective clinical additions.
            </p>

            <form onSubmit={handleAddCorrection} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700">Correction Text *</label>
                <textarea
                  value={corrText}
                  onChange={(e) => setCorrText(e.target.value)}
                  rows={3}
                  placeholder="Clinical facts or observation to add or correct..."
                  className="w-full px-3 py-2 border rounded text-sm mt-1"
                  data-help="anaesthesia_record.corr_text"
                />
                {formErrors.text && <p className="text-xs text-red-600 mt-0.5">{formErrors.text}</p>}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Audit Reason *</label>
                <input
                  type="text"
                  value={corrReason}
                  onChange={(e) => setCorrReason(e.target.value)}
                  placeholder="Reason for retrospectively appending correction..."
                  className="w-full px-3 py-2 border rounded text-sm mt-1"
                  data-help="anaesthesia_record.corr_reason"
                />
                {formErrors.reason && <p className="text-xs text-red-600 mt-0.5">{formErrors.reason}</p>}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-100"
                  data-help="anaesthesia_record.corr_cancel_btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-600 text-white rounded text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
                  data-help="anaesthesia_record.corr_submit_btn"
                >
                  Submit Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Incident / Adverse Event Modal (Rule fe0c435dc9) */}
      {showIncidentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-red-700">Report In-Theatre Adverse Incident</h2>
            <p className="text-xs text-gray-600">
              Charts and reports an adverse event or near-miss to hospital quality assurance (POST /incidents, area: Anaesthesia).
            </p>

            <form onSubmit={handleSubmitIncident} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700">Incident Category *</label>
                <select
                  value={selectedIncidentTypeCode}
                  onChange={(e) => setSelectedIncidentTypeCode(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm mt-1 bg-white"
                  data-help="anaesthesia_record.incident_type"
                >
                  {incidentTypesList.map((t) => (
                    <option key={t.type_code} value={t.type_code}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Summary of Event *</label>
                <textarea
                  value={incidentSummary}
                  onChange={(e) => setIncidentSummary(e.target.value)}
                  rows={3}
                  placeholder="Detailed clinical account of the event, immediate interventions, outcome..."
                  className="w-full px-3 py-2 border rounded text-sm mt-1"
                  data-help="anaesthesia_record.incident_summary"
                />
                {formErrors.summary && <p className="text-xs text-red-600 mt-0.5">{formErrors.summary}</p>}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowIncidentModal(false)}
                  className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-100"
                  data-help="anaesthesia_record.incident_cancel_btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-red-600 text-white rounded text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                  data-help="anaesthesia_record.incident_submit_btn"
                >
                  Submit Incident Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
