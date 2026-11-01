import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { EstablishmentOut } from "../generated/facility_profile";
import type {
  SurgicalRecordOut,
  SurgicalWorklistItemOut,
  ChecklistItemOut,
  ChecklistAnswerIn,
  TeamMemberIn,
  ClinicalPrivilegeOut,
  StaffLookupOut,
  IncidentTypeOut,
} from "../generated/safety_checklist";
import {
  worklistOtClinical as clinicalWorklist,
  getRecord as getSurgicalRecord,
  listChecklistItems as checklistItems,
  safetyCheck as safetyChecks,
  correct as corrections,
  reportIncidents as createIncidents,
  listTypes as incidentTypes,
  listPrivileges,
  lookupStaff,
} from "../generated/safety_checklist";
import {
  getSafetyChecklistScreenView,
  isSurgeryActive,
  canOperateChecklist,
  determineNextPhase,
  checkPhasePrerequisites,
  validateChecklistAnswers,
  validateTimeOutTeam,
  explainSafetyChecklistError,
  ClinicalUser,
} from "../safety-checklist-policy";

export interface SafetyChecklistProps {
  establishment?: EstablishmentOut | null;
  currentUser?: ClinicalUser | null;
  connected?: boolean;
  stream?: any;
  timeZone?: string;
  onNavigate?: (screenId: string) => void;
  onNavigateScreen?: (screenId: string) => void;
}

export const SafetyChecklist: React.FC<SafetyChecklistProps> = ({
  establishment,
  currentUser,
  connected = true,
  stream,
  timeZone = "Asia/Karachi",
  onNavigate,
  onNavigateScreen,
}) => {
  const viewMode = getSafetyChecklistScreenView(establishment);
  const surgeryActive = isSurgeryActive(establishment);
  const authorized = canOperateChecklist(currentUser);

  // Active view: "worklist" | "checklist"
  const [activeView, setActiveView] = useState<"worklist" | "checklist">("worklist");

  // Worklist state
  const [worklist, setWorklist] = useState<SurgicalWorklistItemOut[]>([]);
  const [filterDays, setFilterDays] = useState<number>(3);
  const [filterMine, setFilterMine] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Selected Booking & Record
  const [selectedBooking, setSelectedBooking] = useState<SurgicalWorklistItemOut | null>(null);
  const [surgicalRecord, setSurgicalRecord] = useState<SurgicalRecordOut | null>(null);

  // Active checklist phase: "SignIn" | "TimeOut" | "SignOut"
  const [selectedPhase, setSelectedPhase] = useState<"SignIn" | "TimeOut" | "SignOut">("SignIn");

  // Checklist catalog items from server (GET /ot/checklist-items)
  const [allItems, setAllItems] = useState<ChecklistItemOut[]>([]);

  // Answers map: itemId -> { response: "Yes"|"No"|"NotApplicable", note?: string }
  const [answers, setAnswers] = useState<Record<number, { response: "Yes" | "No" | "NotApplicable"; note?: string }>>({});

  // Team attendance for TimeOut (Rule c4919df195)
  const [privileges, setPrivileges] = useState<ClinicalPrivilegeOut[]>([]);
  const [selectedSurgeonId, setSelectedSurgeonId] = useState<number | null>(null);
  const [selectedAnaesthetistId, setSelectedAnaesthetistId] = useState<number | null>(null);
  const [scrubNurseName, setScrubNurseName] = useState<string>("");
  const [circulatingNurseName, setCirculatingNurseName] = useState<string>("");
  const [verbalConfirmed, setVerbalConfirmed] = useState<boolean>(false);

  // Incident reporting modal
  const [showIncidentModal, setShowIncidentModal] = useState<boolean>(false);
  const [incidentTypeList, setIncidentTypeList] = useState<IncidentTypeOut[]>([]);
  const [selectedIncidentCode, setSelectedIncidentCode] = useState<string>("");
  const [incidentDescription, setIncidentDescription] = useState<string>("");

  // Correction modal (Rule 9e9cb593cb)
  const [showCorrectionModal, setShowCorrectionModal] = useState<boolean>(false);
  const [correctionPart, setCorrectionPart] = useState<string>("SafetyChecklist");
  const [correctionText, setCorrectionText] = useState<string>("");
  const [correctionReason, setCorrectionReason] = useState<string>("");

  // UI status
  const [loading, setLoading] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<{ en: string; ur: string } | null>(null);
  const [successBanner, setSuccessBanner] = useState<{ en: string; ur: string } | null>(null);

  // Load checklist items catalog
  const loadChecklistCatalog = useCallback(async () => {
    try {
      const items = await checklistItems();
      setAllItems(items);
    } catch (err: any) {
      console.warn("Could not load checklist catalog:", err);
    }
  }, []);

  // Load clinical privileges
  const loadPrivileges = useCallback(async () => {
    try {
      const privs = await listPrivileges();
      setPrivileges(privs);
    } catch (err: any) {
      console.warn("Could not load privileges:", err);
    }
  }, []);

  // Load incident types
  const loadIncidentTypes = useCallback(async () => {
    try {
      const types = await incidentTypes();
      setIncidentTypeList(types);
      if (types.length > 0) {
        setSelectedIncidentCode(types[0].type_code);
      }
    } catch (err: any) {
      console.warn("Could not load incident types:", err);
    }
  }, []);

  // Load surgical worklist (Rule cafa8b3761)
  const loadWorklist = useCallback(async () => {
    try {
      setLoading(true);
      setErrorBanner(null);
      const data = await clinicalWorklist({ days: filterDays, mine: filterMine });
      setWorklist(data);
    } catch (err: any) {
      setErrorBanner(explainSafetyChecklistError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  }, [filterDays, filterMine]);

  // Load full surgical record for a booking
  const loadRecord = useCallback(async (bookingId: number) => {
    try {
      setLoading(true);
      setErrorBanner(null);
      const rec = await getSurgicalRecord(bookingId);
      setSurgicalRecord(rec);

      // Auto-select next pending phase
      const nextPhase = determineNextPhase(rec);
      if (nextPhase) {
        setSelectedPhase(nextPhase);
      }

      // Pre-populate answers with defaults
      setAnswers({});
      setVerbalConfirmed(false);
      setActiveView("checklist");
    } catch (err: any) {
      setErrorBanner(explainSafetyChecklistError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load & realtime subscriptions
  useEffect(() => {
    loadChecklistCatalog();
    loadPrivileges();
    loadIncidentTypes();
    loadWorklist();
  }, [loadChecklistCatalog, loadPrivileges, loadIncidentTypes, loadWorklist]);

  useEffect(() => {
    if (!stream?.subscribe) return;
    const unsub = stream.subscribe("ot.clinical.updated", () => {
      loadWorklist();
      if (selectedBooking) loadRecord(selectedBooking.booking_id);
    });
    return unsub;
  }, [stream, selectedBooking, loadWorklist, loadRecord]);

  // Filtered items for current phase
  const currentPhaseItems = useMemo(() => {
    return allItems
      .filter((i) => i.phase === selectedPhase && i.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [allItems, selectedPhase]);

  // Surgeons & Anaesthetists from privileges
  const surgeonPrivileges = useMemo(() => {
    return privileges.filter((p) => p.privilege === "Surgery" && !p.revoked_at);
  }, [privileges]);

  const anaesthetistPrivileges = useMemo(() => {
    return privileges.filter(
      (p) => (p.privilege === "Anaesthesia" || p.privilege === "PreAnaesthesiaAssessment") && !p.revoked_at
    );
  }, [privileges]);

  // Filtered worklist
  const filteredWorklist = useMemo(() => {
    if (!searchQuery.trim()) return worklist;
    const q = searchQuery.toLowerCase();
    return worklist.filter(
      (item) =>
        item.patient_name.toLowerCase().includes(q) ||
        item.mrn.toLowerCase().includes(q) ||
        item.procedure_name.toLowerCase().includes(q) ||
        item.surgeon_name.toLowerCase().includes(q)
    );
  }, [worklist, searchQuery]);

  // Check prerequisites for current phase
  const prereqCheck = useMemo(() => {
    return checkPhasePrerequisites(selectedPhase, surgicalRecord);
  }, [selectedPhase, surgicalRecord]);

  // Check if current phase is already completed
  const isCurrentPhaseCompleted = useMemo(() => {
    return surgicalRecord?.checklist?.some((p) => p.phase === selectedPhase) ?? false;
  }, [surgicalRecord, selectedPhase]);

  // Existing pause details
  const existingPause = useMemo(() => {
    return surgicalRecord?.checklist?.find((p) => p.phase === selectedPhase);
  }, [surgicalRecord, selectedPhase]);

  // Set answer helper
  const handleSetAnswer = (itemId: number, response: "Yes" | "No" | "NotApplicable", note?: string) => {
    setAnswers((prev) => ({
      ...prev,
      [itemId]: {
        response,
        note: note !== undefined ? note : prev[itemId]?.note,
      },
    }));
  };

  // Submit Safety Check Pause (POST /ot/bookings/{id}/safety-checks)
  const handleSubmitPause = async () => {
    if (!selectedBooking) return;

    if (!prereqCheck.allowed) {
      setErrorBanner({
        en: prereqCheck.blockers.join(" "),
        ur: "مرحلے کی پیشگی شرائط نامکمل ہیں۔",
      });
      return;
    }

    if (!verbalConfirmed) {
      setErrorBanner({
        en: "Verbal confirmation to operative team must be certified before submission.",
        ur: "آپریشن تھیٹر ٹیم کو اونچی آواز میں پڑھ کر سنانے کی تصدیق لازمی ہے۔",
      });
      return;
    }

    // Build answers list
    const answerList: ChecklistAnswerIn[] = currentPhaseItems.map((item) => {
      const recorded = answers[item.item_id];
      return {
        item_id: item.item_id,
        answer: recorded?.response ?? "Yes",
        note: recorded?.note?.trim() || null,
      };
    });

    const ansVal = validateChecklistAnswers(currentPhaseItems, answerList);
    if (!ansVal.valid) {
      setErrorBanner({ en: ansVal.errors.join(" "), ur: "چیک لسٹ کے سوالات نامکمل ہیں۔" });
      return;
    }

    // Team members for TimeOut (Rule c4919df195)
    let teamMembers: TeamMemberIn[] | undefined = undefined;
    let teamNote: string | undefined = undefined;
    if (selectedPhase === "TimeOut") {
      teamMembers = [];
      if (selectedSurgeonId) {
        teamMembers.push({ employee_id: selectedSurgeonId, role_in_ot: "PrimarySurgeon" });
      }
      if (selectedAnaesthetistId) {
        teamMembers.push({ employee_id: selectedAnaesthetistId, role_in_ot: "Anesthetist" });
      }

      const teamVal = validateTimeOutTeam(teamMembers);
      if (!teamVal.valid) {
        setErrorBanner({ en: teamVal.errors.join(" "), ur: "ٹیم کی حاضری نامکمل ہے۔" });
        return;
      }

      const noteParts: string[] = [];
      if (scrubNurseName.trim()) noteParts.push(`Scrub Nurse: ${scrubNurseName.trim()}`);
      if (circulatingNurseName.trim()) noteParts.push(`Circulating Nurse: ${circulatingNurseName.trim()}`);
      if (noteParts.length > 0) {
        teamNote = noteParts.join("; ");
      }
    }

    try {
      setLoading(true);
      setErrorBanner(null);
      const updatedRec = await safetyChecks(selectedBooking.booking_id, {
        phase: selectedPhase,
        answers: answerList,
        team: teamMembers,
        note: teamNote,
      });
      setSurgicalRecord(updatedRec);
      setSuccessBanner({
        en: `Surgical safety checklist pause "${selectedPhase}" successfully completed and signed.`,
        ur: `سرجیکل سیفٹی چیک لسٹ کا مرحلہ "${selectedPhase}" کامیابی سے مکمل ہو گیا۔`,
      });
      setVerbalConfirmed(false);
      loadWorklist();
    } catch (err: any) {
      setErrorBanner(explainSafetyChecklistError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  };

  // Add correction (Rule 9e9cb593cb)
  const handleAddCorrection = async () => {
    if (!selectedBooking) return;
    if (!correctionText.trim() || !correctionReason.trim()) {
      setErrorBanner({ en: "Correction text and reason are mandatory.", ur: "تصحیح کا متن اور وجہ دونوں لازمی ہیں۔" });
      return;
    }

    try {
      setLoading(true);
      setErrorBanner(null);
      const updated = await corrections(selectedBooking.booking_id, {
        record: "SafetyChecklist",
        correction_text: correctionText.trim(),
        correction_reason: correctionReason.trim(),
      });
      setSurgicalRecord(updated);
      setShowCorrectionModal(false);
      setCorrectionText("");
      setCorrectionReason("");
      setSuccessBanner({
        en: "Correction addendum successfully recorded under surgical safety record.",
        ur: "ریکارڈ کی باضابطہ تصحیح کامیابی سے محفوظ ہو گئی۔",
      });
    } catch (err: any) {
      setErrorBanner(explainSafetyChecklistError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  };

  // Report incident
  const handleReportIncident = async () => {
    if (!selectedBooking || !incidentDescription.trim()) {
      setErrorBanner({ en: "Incident description is required.", ur: "واقعے کی تفصیل لازمی ہے۔" });
      return;
    }

    try {
      setLoading(true);
      setErrorBanner(null);
      await createIncidents({
        type_code: selectedIncidentCode,
        occurred_at: new Date().toISOString(),
        affected: "Patient",
        patient_id: selectedBooking.patient_id,
        booking_id: selectedBooking.booking_id,
        location: `OT Room ${selectedBooking.ot_name || "Theatre"}`,
        description: incidentDescription.trim(),
        immediate_action: "Immediate corrective action documented in surgical record.",
      });
      setShowIncidentModal(false);
      setIncidentDescription("");
      setSuccessBanner({
        en: "Incident/near-miss report submitted successfully to Quality & Safety Committee.",
        ur: "واقعے کی رپورٹ کوالٹی کمیٹی کو کامیابی سے ارسال کر دی گئی۔",
      });
    } catch (err: any) {
      setErrorBanner(explainSafetyChecklistError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  };

  if (viewMode === "hidden") {
    return (
      <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-xl m-4 border border-slate-200">
        <p className="font-semibold text-sm">Surgical safety checklist is hidden in this facility profile.</p>
        <p className="text-xs text-slate-400 mt-1">سرجری سروس اس پروفائل میں دستیاب نہیں ہے۔</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              Surgical Safety Checklist
            </h1>
            <span className="text-xs font-urdu text-slate-500 font-medium">
              جراحی سیفٹی چیک لسٹ (سائن ان، ٹائم آؤٹ، سائن آؤٹ)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            WHO Guidelines & MSDS COP 39, 41, 44 • Rules cafa8b3761, b410c48dc4, a90b6173b4, c4919df195
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeView === "checklist" && (
            <button
              data-help="safety_checklist.back_to_worklist_button"
              onClick={() => {
                setActiveView("worklist");
                loadWorklist();
              }}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 text-xs font-semibold"
            >
              ← Back to OT Queue
            </button>
          )}
          <button
            data-help="safety_checklist.refresh_button"
            onClick={loadWorklist}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1"
          >
            <span>↻ Refresh</span>
          </button>
        </div>
      </div>

      {/* Retiring Banner */}
      {viewMode === "open_work" && (
        <div className="p-3 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg text-xs font-medium">
          ⚠️ Surgery service is retiring. Existing operations may proceed, but no new cases can be scheduled.
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
            data-help="safety_checklist.dismiss_alert_button"
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
            data-help="safety_checklist.dismiss_alert_button"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-500 hover:text-emerald-700 font-bold px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 1: SURGICAL WORKLIST / QUEUE */}
      {/* ========================================================= */}
      {activeView === "worklist" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  data-help="safety_checklist.filter_mine_toggle"
                  checked={filterMine}
                  onChange={(e) => setFilterMine(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>My assigned cases only</span>
              </label>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-600 font-medium">Timeframe:</span>
                <select
                  data-help="safety_checklist.filter_days_select"
                  value={filterDays}
                  onChange={(e) => setFilterDays(Number(e.target.value))}
                  className="p-1.5 border rounded-lg bg-white text-slate-800 text-xs font-semibold"
                >
                  <option value={1}>Today Only</option>
                  <option value={3}>Next 3 Days</option>
                  <option value={7}>Next 7 Days</option>
                  <option value={14}>Next 14 Days</option>
                </select>
              </div>
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                data-help="safety_checklist.search_worklist_input"
                placeholder="Search patient, MRN, procedure..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2 text-xs border rounded-lg bg-white text-slate-900"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b uppercase text-[10px] tracking-wider font-bold">
                  <th className="p-3">Booking</th>
                  <th className="p-3">Patient / MRN</th>
                  <th className="p-3">Procedure & Room</th>
                  <th className="p-3">Surgeon & Anaesthetist</th>
                  <th className="p-3">Checklist Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWorklist.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      {loading ? "Loading surgical worklist..." : "No surgical cases requiring checklist work."}
                    </td>
                  </tr>
                ) : (
                  filteredWorklist.map((item) => (
                    <tr key={item.booking_id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-800">
                        #{item.booking_number}
                        <div className="text-[10px] text-slate-500 font-sans">
                          {item.booking_type}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{item.patient_name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{item.mrn}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{item.procedure_name}</div>
                        <div className="text-[10px] text-slate-500">
                          Room: {item.ot_name || "Unassigned"}
                        </div>
                      </td>
                      <td className="p-3 text-slate-700">
                        <div>👨‍⚕️ {item.surgeon_name}</div>
                        <div className="text-[10px] text-slate-500">
                          {item.anaesthetist_id ? `🩺 Anaesthetist #${item.anaesthetist_id}` : "Pending Anaesthetist"}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {item.parts?.map((p, idx) => (
                            <span
                              key={idx}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                p.state === "Final"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : p.state === "Draft"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {p.label}: {p.state}
                            </span>
                          ))}
                        </div>
                        {item.next_step && (
                          <div className="text-[10px] text-indigo-600 font-medium mt-1">
                            Next: {item.next_step}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          data-help="safety_checklist.open_booking_button"
                          onClick={() => {
                            setSelectedBooking(item);
                            loadRecord(item.booking_id);
                          }}
                          className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs"
                        >
                          Checklist / جائزہ
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
      {/* VIEW 2: CHECKLIST EXECUTION (Rule cafa8b3761) */}
      {/* ========================================================= */}
      {activeView === "checklist" && selectedBooking && surgicalRecord && (
        <div className="space-y-4">
          {/* Patient and Surgery Context Header */}
          <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-800">
                  OT #{selectedBooking.booking_number}
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {selectedBooking.procedure_name}
                </span>
              </div>
              <div className="text-xs text-slate-600 mt-1">
                <strong>{selectedBooking.patient_name}</strong> • MRN: {selectedBooking.mrn} • Surgeon:{" "}
                {selectedBooking.surgeon_name} • Anaesthesia: {selectedBooking.anaesthetist_id ? `Anaesthetist #${selectedBooking.anaesthetist_id}` : "Not assigned"}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                data-help="safety_checklist.open_incident_modal_button"
                onClick={() => setShowIncidentModal(true)}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg text-xs"
              >
                ⚠️ Report Safety Incident
              </button>
              <button
                data-help="safety_checklist.open_correction_modal_button"
                onClick={() => setShowCorrectionModal(true)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
              >
                📝 Add Correction Addendum
              </button>
            </div>
          </div>

          {/* Stepper Tabs: Sign In -> Time Out -> Sign Out */}
          <div className="grid grid-cols-3 gap-2">
            {/* 1. Sign In */}
            <button
              data-help="safety_checklist.tab_signin_button"
              onClick={() => setSelectedPhase("SignIn")}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedPhase === "SignIn"
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : surgicalRecord.checklist?.some((c) => c.phase === "SignIn")
                  ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs">1. Sign In (سائن ان)</span>
                {surgicalRecord.checklist?.some((c) => c.phase === "SignIn") ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">
                    ✓ Done
                  </span>
                ) : (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${selectedPhase === "SignIn" ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                    Pending
                  </span>
                )}
              </div>
              <div className={`text-[10px] mt-0.5 ${selectedPhase === "SignIn" ? "text-indigo-100" : "text-slate-500"}`}>
                Before Anaesthesia Induction (Rule a90b6173b4)
              </div>
            </button>

            {/* 2. Time Out */}
            <button
              data-help="safety_checklist.tab_timeout_button"
              onClick={() => setSelectedPhase("TimeOut")}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedPhase === "TimeOut"
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : surgicalRecord.checklist?.some((c) => c.phase === "TimeOut")
                  ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs">2. Time Out (ٹائم آؤٹ)</span>
                {surgicalRecord.checklist?.some((c) => c.phase === "TimeOut") ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">
                    ✓ Done
                  </span>
                ) : (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${selectedPhase === "TimeOut" ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                    Pending
                  </span>
                )}
              </div>
              <div className={`text-[10px] mt-0.5 ${selectedPhase === "TimeOut" ? "text-indigo-100" : "text-slate-500"}`}>
                Before Skin Incision (Rule c4919df195)
              </div>
            </button>

            {/* 3. Sign Out */}
            <button
              data-help="safety_checklist.tab_signout_button"
              onClick={() => setSelectedPhase("SignOut")}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedPhase === "SignOut"
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : surgicalRecord.checklist?.some((c) => c.phase === "SignOut")
                  ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs">3. Sign Out (سائن آؤٹ)</span>
                {surgicalRecord.checklist?.some((c) => c.phase === "SignOut") ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">
                    ✓ Done
                  </span>
                ) : (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${selectedPhase === "SignOut" ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                    Pending
                  </span>
                )}
              </div>
              <div className={`text-[10px] mt-0.5 ${selectedPhase === "SignOut" ? "text-indigo-100" : "text-slate-500"}`}>
                Before Leaving Operating Room (Rule 45c2bd9ac6)
              </div>
            </button>
          </div>

          {/* Prerequisite Warnings (Rule a90b6173b4) */}
          {!prereqCheck.allowed && !isCurrentPhaseCompleted && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <span>⚠️ Prerequisite Requirements Block {selectedPhase}:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-amber-800 font-medium">
                {prereqCheck.blockers.map((b, idx) => (
                  <li key={idx}>{b}</li>
                ))}
              </ul>
              <p className="text-[11px] text-amber-700 italic">
                All clinical records and consents must be completed and signed before this pause can be executed.
              </p>
            </div>
          )}

          {/* Completed Pause Display (Rule 9e9cb593cb: Signed parts are read-only) */}
          {isCurrentPhaseCompleted && existingPause && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                    ✓ Pause "{selectedPhase}" Completed and Signed (OT_RECORD_FINAL)
                  </h3>
                  <p className="text-[11px] text-emerald-700">
                    Recorded at {new Date(existingPause.completed_at).toLocaleString()} by {existingPause.author_stamp?.name || existingPause.author_stamp?.text || "Theatre Staff"}
                  </p>
                </div>
                <button
                  data-help="safety_checklist.open_correction_modal_button"
                  onClick={() => {
                    setCorrectionPart(`SafetyChecklist.${selectedPhase}`);
                    setShowCorrectionModal(true);
                  }}
                  className="px-3 py-1 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs"
                >
                  + Add Correction Addendum
                </button>
              </div>

              {/* Answers list */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs pt-2 border-t border-emerald-200">
                {existingPause.answers?.map((ans, idx) => {
                  const item = allItems.find((i) => i.item_id === ans.item_id);
                  return (
                    <div key={idx} className="p-2 bg-white rounded-lg border border-emerald-100">
                      <span className="font-semibold text-slate-800">{item?.prompt ?? ans.prompt ?? `Item #${ans.item_id}`}: </span>
                      <span className="font-bold text-emerald-700">{ans.answer}</span>
                      {ans.note && (
                        <div className="text-[10px] text-slate-500 italic mt-0.5">Note: {ans.note}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Checklist Form (Rule b410c48dc4) */}
          {!isCurrentPhaseCompleted && (
            <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div className="border-b pb-2">
                <h3 className="font-bold text-xs uppercase tracking-wide text-slate-800">
                  {selectedPhase} Interactive Checklist Verification
                </h3>
                <p className="text-xs text-slate-500">
                  Confirmations must be positively verified Yes. Note required when condition matches.
                </p>
              </div>

              {/* Time Out Team Selection (Rule c4919df195) */}
              {selectedPhase === "TimeOut" && (
                <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3 text-xs">
                  <h4 className="font-bold text-indigo-900 uppercase tracking-wide">
                    Operating Theatre Team Attendance (Rule c4919df195)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold">Primary Surgeon (PMDC Privilege):</label>
                      <select
                        data-help="safety_checklist.select_surgeon"
                        value={selectedSurgeonId ?? ""}
                        onChange={(e) => setSelectedSurgeonId(Number(e.target.value) || null)}
                        className="w-full mt-1 p-2 border rounded-lg bg-white text-slate-900 font-bold"
                      >
                        <option value="">Select Operating Surgeon...</option>
                        {surgeonPrivileges.map((p) => (
                          <option key={p.privilege_id} value={p.employee_id}>
                            {p.full_name} ({p.designation ?? "Surgeon"})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold">Primary Anaesthetist:</label>
                      <select
                        data-help="safety_checklist.select_anaesthetist"
                        value={selectedAnaesthetistId ?? ""}
                        onChange={(e) => setSelectedAnaesthetistId(Number(e.target.value) || null)}
                        className="w-full mt-1 p-2 border rounded-lg bg-white text-slate-900 font-bold"
                      >
                        <option value="">Select Anaesthetist...</option>
                        {anaesthetistPrivileges.map((p) => (
                          <option key={p.privilege_id} value={p.employee_id}>
                            {p.full_name} ({p.designation ?? "Anaesthetist"})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold">Scrub Nurse Name:</label>
                      <input
                        type="text"
                        data-help="safety_checklist.input_scrub_nurse"
                        value={scrubNurseName}
                        onChange={(e) => setScrubNurseName(e.target.value)}
                        placeholder="e.g. Staff Nurse Farzana"
                        className="w-full mt-1 p-2 border rounded-lg bg-white text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold">Circulating Nurse Name:</label>
                      <input
                        type="text"
                        data-help="safety_checklist.input_circulating_nurse"
                        value={circulatingNurseName}
                        onChange={(e) => setCirculatingNurseName(e.target.value)}
                        placeholder="e.g. Staff Nurse Aisha"
                        className="w-full mt-1 p-2 border rounded-lg bg-white text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Checklist Items list */}
              <div className="space-y-3">
                {currentPhaseItems.length === 0 ? (
                  <p className="text-slate-400 text-xs italic">No items configured for this phase.</p>
                ) : (
                  currentPhaseItems.map((item) => {
                    const ans = answers[item.item_id] ?? { response: "Yes" };
                    const needsNote = item.note_when && ans.response === item.note_when;
                    return (
                      <div
                        key={item.item_id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex-1">
                            <span className="font-bold text-slate-800">{item.prompt}</span>
                            {item.reference && (
                              <p className="text-[11px] text-slate-500 mt-0.5">{item.reference}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <select
                              data-help="safety_checklist.answer_response_select"
                              value={ans.response}
                              onChange={(e) =>
                                handleSetAnswer(item.item_id, e.target.value as any)
                              }
                              className={`p-1.5 border rounded-lg font-bold text-xs ${
                                ans.response === "Yes"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                  : ans.response === "NotApplicable"
                                  ? "bg-slate-100 text-slate-700"
                                  : "bg-rose-50 text-rose-800 border-rose-300"
                              }`}
                            >
                              <option value="Yes">Yes / تصدیق</option>
                              {item.allow_na && <option value="NotApplicable">N/A (Not Applicable)</option>}
                              {item.kind === "Question" && <option value="No">No / نہیں</option>}
                            </select>
                          </div>
                        </div>

                        {needsNote && (
                          <div className="pt-2 border-t border-slate-200">
                            <label className="block text-[11px] font-semibold text-rose-700 mb-1">
                              Mandatory Explanatory Note (when {item.note_when}):
                            </label>
                            <input
                              type="text"
                              data-help="safety_checklist.answer_note_input"
                              value={ans.note ?? ""}
                              onChange={(e) => handleSetAnswer(item.item_id, ans.response, e.target.value)}
                              placeholder="Clinical explanation required..."
                              className="w-full p-2 text-xs border rounded-lg bg-white text-slate-900 border-rose-300"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Verbal Confirmation Certification */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-emerald-900">
                  <input
                    type="checkbox"
                    data-help="safety_checklist.toggle_verbal_pause_confirmed"
                    checked={verbalConfirmed}
                    onChange={(e) => setVerbalConfirmed(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    ✓ Verbal Pause Executed: All checklist items were read aloud and confirmed by the operative team in the operating theatre.
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex justify-end">
                <button
                  data-help="safety_checklist.submit_pause_button"
                  onClick={handleSubmitPause}
                  disabled={loading || !prereqCheck.allowed}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-sm transition-all"
                >
                  ✓ Complete & Sign "{selectedPhase}" Pause
                </button>
              </div>
            </div>
          )}

          {/* Incident Modal */}
          {showIncidentModal && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="font-bold text-sm text-rose-800">
                    Report Theatre Safety Incident / واقعہ رپورٹ
                  </h3>
                  <button
                    data-help="safety_checklist.close_incident_modal_button"
                    onClick={() => setShowIncidentModal(false)}
                    className="text-slate-400 hover:text-slate-600 font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Incident Category:</label>
                    <select
                      data-help="safety_checklist.select_incident_type"
                      value={selectedIncidentCode}
                      onChange={(e) => setSelectedIncidentCode(e.target.value)}
                      className="w-full p-2 border rounded-lg bg-white text-slate-900 font-bold"
                    >
                      {incidentTypeList.map((t) => (
                        <option key={t.type_code} value={t.type_code}>
                          {t.name} ({t.area})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Incident Description / واقعے کی تفصیل:
                    </label>
                    <textarea
                      data-help="safety_checklist.input_incident_description"
                      value={incidentDescription}
                      onChange={(e) => setIncidentDescription(e.target.value)}
                      rows={3}
                      placeholder="e.g. Swab count discrepancy resolved; equipment malfunction; incorrect consent form version"
                      className="w-full p-2 border rounded-lg bg-white text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t pt-3">
                  <button
                    data-help="safety_checklist.close_incident_modal_button"
                    onClick={() => setShowIncidentModal(false)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    data-help="safety_checklist.submit_incident_button"
                    onClick={handleReportIncident}
                    disabled={loading || !incidentDescription.trim()}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs"
                  >
                    Submit Report
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Correction Addendum Modal (Rule 9e9cb593cb) */}
          {showCorrectionModal && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="font-bold text-sm text-slate-800">
                    Add Correction Addendum (Rule 9e9cb593cb)
                  </h3>
                  <button
                    data-help="safety_checklist.close_correction_modal_button"
                    onClick={() => setShowCorrectionModal(false)}
                    className="text-slate-400 hover:text-slate-600 font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Checklist Part:</label>
                    <select
                      data-help="safety_checklist.select_correction_part"
                      value={correctionPart}
                      onChange={(e) => setCorrectionPart(e.target.value)}
                      className="w-full p-2 border rounded-lg bg-white text-slate-900 font-bold"
                    >
                      <option value="SafetyChecklist">General Safety Checklist</option>
                      <option value="SafetyChecklist.SignIn">Sign In</option>
                      <option value="SafetyChecklist.TimeOut">Time Out</option>
                      <option value="SafetyChecklist.SignOut">Sign Out</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Correction Text:</label>
                    <textarea
                      data-help="safety_checklist.input_correction_text"
                      value={correctionText}
                      onChange={(e) => setCorrectionText(e.target.value)}
                      rows={2}
                      placeholder="e.g. Pulse oximeter recalibrated after initial probe error"
                      className="w-full p-2 border rounded-lg bg-white text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Clinical Reason:</label>
                    <input
                      type="text"
                      data-help="safety_checklist.input_correction_reason"
                      value={correctionReason}
                      onChange={(e) => setCorrectionReason(e.target.value)}
                      placeholder="e.g. Documentation accuracy update"
                      className="w-full p-2 border rounded-lg bg-white text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t pt-3">
                  <button
                    data-help="safety_checklist.close_correction_modal_button"
                    onClick={() => setShowCorrectionModal(false)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    data-help="safety_checklist.submit_correction_button"
                    onClick={handleAddCorrection}
                    disabled={loading || !correctionText.trim() || !correctionReason.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs"
                  >
                    Save Correction
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
