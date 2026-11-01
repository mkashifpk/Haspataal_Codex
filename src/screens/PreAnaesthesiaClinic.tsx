import React, { useState, useEffect, useMemo, useCallback } from "react";
import { EstablishmentOut } from "../generated/facility_profile";
import {
  SurgicalWorklistItemOut,
  SurgicalRecordOut,
  PreAnaesthesiaIn,
  PreAnaesthesiaOut,
  ClinicalPrivilegeOut,
  ConsentOut,
  worklistOtClinical,
  getRecord,
  preAnaesthesia,
  signPreAnaesthesia,
  listPrivileges,
  createConsents,
  sign as signConsentApi,
  refuse as refuseConsentApi,
  printConsent,
} from "../generated/pre_anaesthesia_clinic";
import {
  getPreAnaesthesiaClinicScreenView,
  isSurgeryActive,
  canAssessPreAnaesthesia,
  hasAnaesthesiaPrivilege,
  validatePreAnaesthesiaDraft,
  validatePreAnaesthesiaSign,
  explainPreAnaesthesiaError,
  ASA_CLASSES,
  MALLAMPATI_CLASSES,
  ClinicalUser,
} from "../pre-anaesthesia-clinic-policy";

interface PreAnaesthesiaClinicProps {
  establishment?: EstablishmentOut | null;
  currentUser?: ClinicalUser | null;
  connected?: boolean;
  stream?: string | null;
  timeZone?: string;
  onNavigate?: (screenId: string) => void;
  onNavigateScreen?: (screenId: string) => void;
}

const latestPac = (rec?: SurgicalRecordOut | null): PreAnaesthesiaOut | null => {
  const list = rec?.pre_anaesthesia;
  return Array.isArray(list) && list.length > 0 ? list[list.length - 1] : null;
};

export const PreAnaesthesiaClinic: React.FC<PreAnaesthesiaClinicProps> = ({
  establishment,
  currentUser,
  connected = true,
  stream,
  timeZone = "Asia/Karachi",
  onNavigate,
  onNavigateScreen,
}) => {
  const navigate = onNavigate || onNavigateScreen;
  const viewMode = getPreAnaesthesiaClinicScreenView(establishment);
  const isServiceActive = isSurgeryActive(establishment);
  const canAssess = canAssessPreAnaesthesia(currentUser);

  // View state: worklist vs assessment
  const [activeView, setActiveView] = useState<"worklist" | "assessment">("worklist");

  // Worklist data & filters
  const [worklist, setWorklist] = useState<SurgicalWorklistItemOut[]>([]);
  const [filterDays, setFilterDays] = useState<number>(3);
  const [mineOnly, setMineOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Privileges list
  const [privileges, setPrivileges] = useState<ClinicalPrivilegeOut[]>([]);

  // Selected booking & record
  const [selectedBooking, setSelectedBooking] = useState<SurgicalWorklistItemOut | null>(null);
  const [surgicalRecord, setSurgicalRecord] = useState<SurgicalRecordOut | null>(null);

  // Form states: PreAnaesthesia
  const [historyText, setHistoryText] = useState<string>("");
  const [medicationsText, setMedicationsText] = useState<string>("");
  const [allergiesText, setAllergiesText] = useState<string>("");
  const [examinationText, setExaminationText] = useState<string>("");
  const [investigationsText, setInvestigationsText] = useState<string>("");
  const [heartRate, setHeartRate] = useState<string>("");
  const [bpSystolic, setBpSystolic] = useState<string>("");
  const [bpDiastolic, setBpDiastolic] = useState<string>("");
  const [spo2, setSpo2] = useState<string>("");
  const [weightKg, setWeightKg] = useState<string>("");
  const [mallampati, setMallampati] = useState<number>(1);
  const [airwayNotes, setAirwayNotes] = useState<string>("");
  const [asaClass, setAsaClass] = useState<number>(1);
  const [asaEmergency, setAsaEmergency] = useState<boolean>(false);
  const [risksText, setRisksText] = useState<string>("");
  const [plannedTechnique, setPlannedTechnique] = useState<string>("General");
  const [planText, setPlanText] = useState<string>("");
  const [premedicationText, setPremedicationText] = useState<string>("");
  const [fastingInstructions, setFastingInstructions] = useState<string>("");
  const [decision, setDecision] = useState<string>("Fit");
  const [decisionNote, setDecisionNote] = useState<string>("");
  const [currentVersion, setCurrentVersion] = useState<number>(1);

  // Consent modal state
  const [showConsentModal, setShowConsentModal] = useState<boolean>(false);
  const [activeConsent, setActiveConsent] = useState<ConsentOut | null>(null);
  const [consentRefuseReason, setConsentRefuseReason] = useState<string>("");

  // Status flags
  const [loading, setLoading] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<{ en: string; ur: string } | null>(null);
  const [successBanner, setSuccessBanner] = useState<{ en: string; ur: string } | null>(null);

  // Fetch worklist and privileges
  const loadWorklist = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    setErrorBanner(null);

    try {
      const [wlData, privData] = await Promise.all([
        worklistOtClinical({
          days: filterDays,
          mine: mineOnly ? true : undefined,
        }),
        listPrivileges({
          include_revoked: false,
        }),
      ]);
      setWorklist(wlData);
      setPrivileges(privData);
    } catch (err: any) {
      console.error("Failed to load clinical worklist", err);
      setErrorBanner(explainPreAnaesthesiaError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  }, [connected, filterDays, mineOnly]);

  useEffect(() => {
    loadWorklist();
  }, [loadWorklist]);

  // Real-time synchronization: ot.clinical.updated, ot.booking.updated
  useEffect(() => {
    if (!stream) return;
    try {
      const parsed = JSON.parse(stream);
      if (parsed.event === "ot.clinical.updated" || parsed.event === "ot.booking.updated") {
        loadWorklist();
        if (selectedBooking && activeView === "assessment") {
          loadRecordDetails(selectedBooking.booking_id);
        }
      }
    } catch {
      // Ignore non-json frames
    }
  }, [stream, loadWorklist, selectedBooking, activeView]);

  // Load record details for a selected booking
  const loadRecordDetails = async (bookingId: number) => {
    try {
      setLoading(true);
      setErrorBanner(null);
      const rec = await getRecord(bookingId);
      setSurgicalRecord(rec);

      const pac = latestPac(rec);
      if (pac) {
        setHistoryText(pac.history ?? "");
        setMedicationsText(pac.medications ?? "");
        setAllergiesText(pac.allergies ?? "");
        setExaminationText(pac.examination ?? "");
        setInvestigationsText(pac.investigations ?? "");
        setHeartRate(pac.heart_rate != null ? String(pac.heart_rate) : "");
        setBpSystolic(pac.bp_systolic != null ? String(pac.bp_systolic) : "");
        setBpDiastolic(pac.bp_diastolic != null ? String(pac.bp_diastolic) : "");
        setSpo2(pac.spo2 != null ? String(pac.spo2) : "");
        setWeightKg(pac.weight_kg != null ? String(pac.weight_kg) : "");
        setMallampati(pac.airway_mallampati ?? 1);
        setAirwayNotes(pac.airway_notes ?? "");
        setAsaClass(pac.asa_class ?? 1);
        setAsaEmergency(Boolean(pac.asa_emergency));
        setRisksText(pac.risks ?? "");
        setPlannedTechnique(pac.planned_technique ?? "General");
        setPlanText(pac.plan ?? "");
        setPremedicationText(pac.premedication ?? "");
        setFastingInstructions(pac.fasting_instructions ?? "");
        setDecision(pac.decision ?? "Fit");
        setDecisionNote(pac.decision_note ?? "");
        setCurrentVersion(pac.row_version ?? 1);
      } else {
        // Reset to initial draft defaults
        setHistoryText("");
        setMedicationsText("");
        setAllergiesText("");
        setExaminationText("");
        setInvestigationsText("");
        setHeartRate("");
        setBpSystolic("");
        setBpDiastolic("");
        setSpo2("");
        setWeightKg("");
        setMallampati(1);
        setAirwayNotes("");
        setAsaClass(1);
        setAsaEmergency(false);
        setRisksText("");
        setPlannedTechnique("General");
        setPlanText("");
        setPremedicationText("");
        setFastingInstructions("NPO 6h solids, 2h clear fluids");
        setDecision("Fit");
        setDecisionNote("");
        setCurrentVersion(1);
      }
    } catch (err: any) {
      setErrorBanner(explainPreAnaesthesiaError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  };

  // Open PAC assessment for a booking
  const handleOpenAssessment = (item: SurgicalWorklistItemOut) => {
    setSelectedBooking(item);
    setActiveView("assessment");
    loadRecordDetails(item.booking_id);
  };

  // Build draft payload
  const buildPayload = (reassess: boolean = false): PreAnaesthesiaIn => {
    return {
      history: historyText.trim() || null,
      medications: medicationsText.trim() || null,
      allergies: allergiesText.trim() || null,
      examination: examinationText.trim() || null,
      investigations: investigationsText.trim() || null,
      heart_rate: heartRate ? Number(heartRate) : null,
      bp_systolic: bpSystolic ? Number(bpSystolic) : null,
      bp_diastolic: bpDiastolic ? Number(bpDiastolic) : null,
      spo2: spo2 ? Number(spo2) : null,
      weight_kg: weightKg ? Number(weightKg) : null,
      airway_mallampati: Number(mallampati),
      airway_notes: airwayNotes.trim() || null,
      asa_class: Number(asaClass),
      asa_emergency: Boolean(asaEmergency),
      risks: risksText.trim() || null,
      planned_technique: plannedTechnique as any,
      plan: planText.trim() || null,
      premedication: premedicationText.trim() || null,
      fasting_instructions: fastingInstructions.trim() || null,
      decision: decision as any,
      decision_note: decisionNote.trim() || null,
      reassess: reassess || undefined,
      expected_version: currentVersion,
    };
  };

  // Save Draft
  const handleSaveDraft = async () => {
    if (!selectedBooking) return;
    const payload = buildPayload(false);

    const val = validatePreAnaesthesiaDraft(payload);
    if (!val.valid) {
      setErrorBanner({ en: val.errors.join(" "), ur: "ڈرافٹ کی معلومات درست نہیں۔" });
      return;
    }

    try {
      setLoading(true);
      setErrorBanner(null);
      const updatedRec = await preAnaesthesia(selectedBooking.booking_id, payload);
      setSurgicalRecord(updatedRec);
      const updatedPac = latestPac(updatedRec);
      if (updatedPac) {
        setCurrentVersion(updatedPac.row_version);
      }
      setSuccessBanner({
        en: "Pre-anaesthesia draft assessment saved successfully.",
        ur: "پری اینستھیزیا ڈرافٹ جائزہ کامیابی سے محفوظ ہو گیا۔",
      });
    } catch (err: any) {
      setErrorBanner(explainPreAnaesthesiaError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  };

  // Sign Assessment (Rule a91aa7215a & Rule d4ca3b3bcc)
  const handleSignAssessment = async () => {
    if (!selectedBooking) return;

    // Check clinical privilege
    const isAuthorized = hasAnaesthesiaPrivilege(privileges, currentUser?.employee_id);
    if (!isAuthorized && currentUser?.roles?.includes("clinical_specialist")) {
      // Inform if privilege missing
    }

    const payload = buildPayload(false);
    const val = validatePreAnaesthesiaSign(payload);
    if (!val.valid) {
      setErrorBanner({ en: val.errors.join(" "), ur: "جائزہ مکمل کریں: تمام لازمی فیلڈز اور نوٹس درج کریں۔" });
      return;
    }

    try {
      setLoading(true);
      setErrorBanner(null);

      // Save latest draft first
      await preAnaesthesia(selectedBooking.booking_id, payload);

      // Sign
      const signedRec = await signPreAnaesthesia(selectedBooking.booking_id, {
        expected_version: currentVersion,
      });
      setSurgicalRecord(signedRec);
      const signedPac = latestPac(signedRec);
      if (signedPac) {
        setCurrentVersion(signedPac.row_version);
      }
      setSuccessBanner({
        en: `Pre-anaesthesia assessment signed as "${decision}". Planned technique: ${plannedTechnique}.`,
        ur: `پری اینستھیزیا جائزہ کامیابی سے دستخط ہو گیا۔ فیصلہ: ${decision}۔`,
      });
    } catch (err: any) {
      setErrorBanner(explainPreAnaesthesiaError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  };

  // Reassess (Rule a91aa7215a: reassess=true creates fresh assessment)
  const handleReassess = async () => {
    if (!selectedBooking) return;
    const payload = buildPayload(true);

    try {
      setLoading(true);
      setErrorBanner(null);
      const rec = await preAnaesthesia(selectedBooking.booking_id, payload);
      setSurgicalRecord(rec);
      const reassessPac = latestPac(rec);
      if (reassessPac) {
        setCurrentVersion(reassessPac.row_version);
      }
      setSuccessBanner({
        en: "New pre-anaesthesia assessment cycle initiated.",
        ur: "نیا پری اینستھیزیا جائزہ شروع کر دیا گیا۔",
      });
    } catch (err: any) {
      setErrorBanner(explainPreAnaesthesiaError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  };

  // Generate Anaesthesia Consent (Rule d5b2105887)
  const handleGenerateConsent = async () => {
    if (!selectedBooking) return;

    try {
      setLoading(true);
      setErrorBanner(null);
      const consent = await createConsents({
        patient_id: selectedBooking.patient_id,
        form_code: "ANAESTHESIA",
        booking_id: selectedBooking.booking_id,
        anesthesia_technique: plannedTechnique,
        anaesthetist_id: currentUser?.employee_id ?? null,
      } as any);

      setActiveConsent(consent);
      setShowConsentModal(true);
      setSuccessBanner({
        en: `Anaesthesia consent form created for ${plannedTechnique} anaesthesia.`,
        ur: `اینستھیزیا رضامندی فارم کامیابی سے تیار ہو گیا۔`,
      });
    } catch (err: any) {
      setErrorBanner(explainPreAnaesthesiaError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  };

  // Sign Consent
  const handleSignConsent = async () => {
    if (!activeConsent) return;
    try {
      setLoading(true);
      setErrorBanner(null);
      const res = await signConsentApi(activeConsent.consent_id, {
        who_decides: "Patient",
        notes: "Signed after thorough anaesthesia risk explanation.",
      } as any);
      setActiveConsent(res);
      setSuccessBanner({
        en: "Anaesthesia consent signed and finalized.",
        ur: "اینستھیزیا رضامندی پر باضابطہ دستخط مکمل ہو گئے۔",
      });
      loadWorklist();
    } catch (err: any) {
      setErrorBanner(explainPreAnaesthesiaError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  };

  // Refuse Consent
  const handleRefuseConsent = async () => {
    if (!activeConsent) return;
    if (!consentRefuseReason.trim()) {
      setErrorBanner({ en: "Refusal reason is mandatory.", ur: "انکار کی وجہ لکھنا لازمی ہے۔" });
      return;
    }
    try {
      setLoading(true);
      setErrorBanner(null);
      const res = await refuseConsentApi(activeConsent.consent_id, {
        refusal_reason: consentRefuseReason.trim(),
      } as any);
      setActiveConsent(res);
      setSuccessBanner({
        en: "Consent refusal recorded.",
        ur: "رضامندی کا باضابطہ انکار درج کر لیا گیا۔",
      });
      loadWorklist();
    } catch (err: any) {
      setErrorBanner(explainPreAnaesthesiaError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  };

  // Print Consent
  const handlePrintConsent = async () => {
    if (!activeConsent) return;
    try {
      await printConsent(activeConsent.consent_id);
      setSuccessBanner({
        en: "Consent document sent to printer.",
        ur: "رضامندی دستاویز پرنٹر پر بھیج دی گئی۔",
      });
    } catch (err: any) {
      setErrorBanner(explainPreAnaesthesiaError(err?.code || "INTERNAL_ERROR", err?.details));
    }
  };

  // Filtered worklist
  const filteredWorklist = useMemo(() => {
    if (!searchQuery.trim()) return worklist;
    const q = searchQuery.toLowerCase().trim();
    return worklist.filter(
      (item) =>
        item.patient_name.toLowerCase().includes(q) ||
        item.mrn.toLowerCase().includes(q) ||
        item.procedure_name.toLowerCase().includes(q) ||
        item.surgeon_name.toLowerCase().includes(q)
    );
  }, [worklist, searchQuery]);

  const activePac = latestPac(surgicalRecord);
  const isFinal = activePac?.status === "Final";

  if (viewMode === "hidden") {
    return (
      <div className="p-8 text-center text-gray-500">
        <p className="text-lg font-semibold">Pre-Anaesthesia Clinic is hidden for this facility.</p>
        <p className="text-sm font-urdu">پری اینستھیزیا کلینک اس ہسپتال کے لیے فعال نہیں ہے۔</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-900 p-4 space-y-4">
      {/* Top Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-3">
          <button
            data-help="pre_anaesthesia_clinic.back_button"
            onClick={() => {
              if (activeView === "assessment") {
                setActiveView("worklist");
                setSelectedBooking(null);
              } else {
                navigate?.("ot_board");
              }
            }}
            className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition font-medium border border-slate-300"
          >
            ← {activeView === "assessment" ? "Back to Worklist" : "Back to OT Board"}
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🩺</span>
              <h1 className="text-lg font-bold text-slate-900">
                Pre-Anaesthesia Clinic (PAC)
              </h1>
              <span className="text-xs font-normal text-slate-500 font-urdu">
                (پری اینستھیزیا کلینک اور فٹنس جائزہ)
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Pre-operative anaesthesia assessment, ASA physical status (COP 31), Mallampati airway exam, NPO instructions, and anaesthetic consent (COP 39)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {activeView === "worklist" && (
            <button
              data-help="pre_anaesthesia_clinic.refresh_button"
              onClick={loadWorklist}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg font-semibold transition"
            >
              {loading ? "Refreshing..." : "↻ Refresh / ریفریش"}
            </button>
          )}
        </div>
      </header>

      {/* Retiring / Inactive Warnings */}
      {viewMode === "open_work" && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-lg text-xs text-amber-900">
          Notice: Surgery service is retiring. You may assess and clear existing scheduled surgical bookings.
        </div>
      )}

      {/* Alerts */}
      {errorBanner && (
        <div className="flex items-center justify-between bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs shadow-sm">
          <div>
            <p className="font-semibold">{errorBanner.en}</p>
            <p className="font-urdu">{errorBanner.ur}</p>
          </div>
          <button
            data-help="pre_anaesthesia_clinic.dismiss_alert_button"
            onClick={() => setErrorBanner(null)}
            className="text-rose-500 hover:text-rose-700 font-bold px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {successBanner && (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs shadow-sm">
          <div>
            <p className="font-semibold">{successBanner.en}</p>
            <p className="font-urdu">{successBanner.ur}</p>
          </div>
          <button
            data-help="pre_anaesthesia_clinic.dismiss_alert_button"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-500 hover:text-emerald-700 font-bold px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* VIEW 1: PAC SURGICAL WORKLIST */}
      {activeView === "worklist" && (
        <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-4 overflow-hidden">
          {/* Worklist Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-700">Days Ahead / ایام:</label>
              <select
                data-help="pre_anaesthesia_clinic.filter_days_select"
                value={filterDays}
                onChange={(e) => setFilterDays(Number(e.target.value))}
                className="px-2.5 py-1 text-xs border rounded-lg bg-white text-slate-800"
              >
                <option value={1}>1 Day (Tomorrow)</option>
                <option value={3}>3 Days Ahead</option>
                <option value={7}>7 Days (1 Week)</option>
                <option value={14}>14 Days (2 Weeks)</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                data-help="pre_anaesthesia_clinic.toggle_mine_only"
                checked={mineOnly}
                onChange={(e) => setMineOnly(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>My Assigned Patients Only / میرے مریض</span>
            </label>

            <div className="flex items-center gap-2 flex-1 justify-end">
              <input
                type="text"
                data-help="pre_anaesthesia_clinic.search_worklist_input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient, MRN, procedure..."
                className="px-3 py-1 text-xs border rounded-lg bg-white w-64 text-slate-800"
              />
            </div>
          </div>

          {/* Worklist Table */}
          <div className="flex-1 overflow-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-800 uppercase font-semibold sticky top-0">
                <tr>
                  <th className="p-3">Booking #</th>
                  <th className="p-3">Patient / MRN</th>
                  <th className="p-3">Procedure</th>
                  <th className="p-3">Schedule & Theatre</th>
                  <th className="p-3">Surgeon</th>
                  <th className="p-3">PAC Status</th>
                  <th className="p-3">Next Clinical Step</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredWorklist.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      No patients awaiting pre-anaesthesia evaluation for the selected days.
                    </td>
                  </tr>
                ) : (
                  filteredWorklist.map((item) => {
                    const pacPart = item.parts.find((p) => p.part === "PreAnaesthesia");
                    const consentPart = item.parts.find((p) => p.part === "AnaesthesiaConsent");

                    return (
                      <tr key={item.booking_id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-mono font-bold text-blue-600">
                          {item.booking_number}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">{item.patient_name}</div>
                          <div className="text-[11px] font-mono text-slate-500">{item.mrn}</div>
                        </td>
                        <td className="p-3 font-medium text-slate-900">
                          <div>{item.procedure_name}</div>
                          <div className="text-[10px] text-slate-500">{item.booking_type}</div>
                        </td>
                        <td className="p-3">
                          <div>{item.ot_name ?? "Unassigned"}</div>
                          <div className="text-[11px] text-slate-500">
                            {item.scheduled_start ? new Date(item.scheduled_start).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "Pending"}
                          </div>
                        </td>
                        <td className="p-3">{item.surgeon_name}</td>
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block text-center ${
                                pacPart?.state === "Final"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : pacPart?.state === "Draft"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              PAC: {pacPart?.state ?? "Missing"}
                            </span>
                            {item.anaesthesia_decision && (
                              <span className="text-[10px] font-semibold text-slate-700">
                                Decision: {item.anaesthesia_decision}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded text-[11px] font-medium">
                            {item.next_step ?? "Evaluation"}
                          </span>
                        </td>
                        <td className="p-3">
                          <button
                            data-help="pre_anaesthesia_clinic.open_assessment_button"
                            onClick={() => handleOpenAssessment(item)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                          >
                            Assess / جائزہ
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: PAC CLINICAL ASSESSMENT FORM */}
      {activeView === "assessment" && selectedBooking && (
        <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-4 overflow-auto">
          {/* Patient Banner */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{selectedBooking.patient_name}</h2>
                <span className="font-mono text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                  {selectedBooking.mrn}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  #{selectedBooking.booking_number}
                </span>
              </div>
              <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-x-4">
                <span>Procedure: <strong>{selectedBooking.procedure_name}</strong></span>
                <span>Surgeon: <strong>{selectedBooking.surgeon_name}</strong></span>
                <span>Theatre: <strong>{selectedBooking.ot_name ?? "Pending"}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  isFinal
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : "bg-amber-100 text-amber-800 border-amber-300"
                }`}
              >
                Status: {activePac?.status ?? "Draft"}
              </span>

              <button
                data-help="pre_anaesthesia_clinic.back_to_worklist_button"
                onClick={() => {
                  setActiveView("worklist");
                  loadWorklist();
                }}
                className="px-3 py-1 text-xs border border-slate-300 rounded-lg hover:bg-slate-100 font-medium"
              >
                Close / بند کریں
              </button>
            </div>
          </div>

          {/* Clinical Form Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* COLUMN 1: VITALS & AIRWAY */}
            <div className="space-y-4">
              {/* Vital Signs Card */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wide border-b pb-2">
                  Pre-Op Vitals / علامات حیات
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-slate-600 block">Heart Rate (bpm):</label>
                    <input
                      type="number"
                      data-help="pre_anaesthesia_clinic.input_heart_rate"
                      disabled={isFinal}
                      value={heartRate}
                      onChange={(e) => setHeartRate(e.target.value)}
                      placeholder="60-100"
                      className="w-full mt-1 p-2 border rounded bg-white text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block">SpO2 (%):</label>
                    <input
                      type="number"
                      data-help="pre_anaesthesia_clinic.input_spo2"
                      disabled={isFinal}
                      value={spo2}
                      onChange={(e) => setSpo2(e.target.value)}
                      placeholder="95-100"
                      className="w-full mt-1 p-2 border rounded bg-white text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block">Systolic BP (mmHg):</label>
                    <input
                      type="number"
                      data-help="pre_anaesthesia_clinic.input_bp_systolic"
                      disabled={isFinal}
                      value={bpSystolic}
                      onChange={(e) => setBpSystolic(e.target.value)}
                      placeholder="120"
                      className="w-full mt-1 p-2 border rounded bg-white text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block">Diastolic BP (mmHg):</label>
                    <input
                      type="number"
                      data-help="pre_anaesthesia_clinic.input_bp_diastolic"
                      disabled={isFinal}
                      value={bpDiastolic}
                      onChange={(e) => setBpDiastolic(e.target.value)}
                      placeholder="80"
                      className="w-full mt-1 p-2 border rounded bg-white text-slate-900"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-slate-600 block">Weight (kg):</label>
                    <input
                      type="number"
                      data-help="pre_anaesthesia_clinic.input_weight_kg"
                      disabled={isFinal}
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      placeholder="e.g. 70"
                      className="w-full mt-1 p-2 border rounded bg-white text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Airway Exam Card */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wide border-b pb-2">
                  Airway Assessment (Mallampati)
                </h3>
                <div className="text-xs space-y-2">
                  <div>
                    <label className="text-slate-700 font-semibold block">Mallampati Class:</label>
                    <select
                      data-help="pre_anaesthesia_clinic.select_mallampati"
                      disabled={isFinal}
                      value={mallampati}
                      onChange={(e) => setMallampati(Number(e.target.value))}
                      className="w-full mt-1 p-2 border rounded bg-white text-slate-900 font-semibold"
                    >
                      <option value={1}>Class I - Full visualization (Low risk)</option>
                      <option value={2}>Class II - Soft palate & uvula</option>
                      <option value={3}>Class III - Soft palate only (Difficult risk)</option>
                      <option value={4}>Class IV - Hard palate only (High difficult airway)</option>
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {MALLAMPATI_CLASSES[mallampati]?.desc}
                    </p>
                  </div>

                  <div>
                    <label className="text-slate-600 block">Airway Notes / دانت، گردن اور رکاوٹیں:</label>
                    <textarea
                      data-help="pre_anaesthesia_clinic.input_airway_notes"
                      disabled={isFinal}
                      value={airwayNotes}
                      onChange={(e) => setAirwayNotes(e.target.value)}
                      placeholder="Neck mobility, mouth opening, loose teeth, thyromental distance"
                      rows={2}
                      className="w-full mt-1 p-2 border rounded bg-white text-slate-900"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* COLUMN 2: MEDICAL HISTORY & INVESTIGATIONS */}
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wide border-b pb-2">
                  Clinical History & Systems Review
                </h3>
                <div className="text-xs space-y-3">
                  <div>
                    <label className="text-slate-600 font-semibold block">Past Medical & Surgical History:</label>
                    <textarea
                      data-help="pre_anaesthesia_clinic.input_history"
                      disabled={isFinal}
                      value={historyText}
                      onChange={(e) => setHistoryText(e.target.value)}
                      placeholder="Cardiovascular, respiratory, renal, hepatic, endocrine conditions..."
                      rows={2}
                      className="w-full mt-1 p-2 border rounded bg-white text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 font-semibold block">Current Medications / جاری ادویات:</label>
                    <textarea
                      data-help="pre_anaesthesia_clinic.input_medications"
                      disabled={isFinal}
                      value={medicationsText}
                      onChange={(e) => setMedicationsText(e.target.value)}
                      placeholder="Antihypertensives, anticoagulants, insulin, inhalers..."
                      rows={2}
                      className="w-full mt-1 p-2 border rounded bg-white text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 font-semibold block">Allergies & Adverse Drug Reactions:</label>
                    <input
                      type="text"
                      data-help="pre_anaesthesia_clinic.input_allergies"
                      disabled={isFinal}
                      value={allergiesText}
                      onChange={(e) => setAllergiesText(e.target.value)}
                      placeholder="e.g. Penicillin, Latex, NSAIDs"
                      className="w-full mt-1 p-2 border rounded bg-white text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 font-semibold block">Physical Examination Findings:</label>
                    <textarea
                      data-help="pre_anaesthesia_clinic.input_examination"
                      disabled={isFinal}
                      value={examinationText}
                      onChange={(e) => setExaminationText(e.target.value)}
                      placeholder="Heart sounds, chest auscultation, peripheral pulses..."
                      rows={2}
                      className="w-full mt-1 p-2 border rounded bg-white text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 font-semibold block">Diagnostic Investigations (ECG, Labs):</label>
                    <textarea
                      data-help="pre_anaesthesia_clinic.input_investigations"
                      disabled={isFinal}
                      value={investigationsText}
                      onChange={(e) => setInvestigationsText(e.target.value)}
                      placeholder="Hb, Platelets, Creatinine, Electrolytes, ECG rhythm, CXR..."
                      rows={2}
                      className="w-full mt-1 p-2 border rounded bg-white text-slate-900"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* COLUMN 3: ASA, PLAN & CLEARANCE DECISION */}
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wide border-b pb-2">
                  ASA Classification & Anaesthesia Plan
                </h3>
                <div className="text-xs space-y-3">
                  <div>
                    <label className="text-slate-700 font-semibold block">ASA Physical Status (COP 31):</label>
                    <select
                      data-help="pre_anaesthesia_clinic.select_asa_class"
                      disabled={isFinal}
                      value={asaClass}
                      onChange={(e) => setAsaClass(Number(e.target.value))}
                      className="w-full mt-1 p-2 border rounded bg-white text-slate-900 font-bold"
                    >
                      <option value={1}>ASA I - Normal healthy patient</option>
                      <option value={2}>ASA II - Mild systemic disease</option>
                      <option value={3}>ASA III - Severe systemic disease</option>
                      <option value={4}>ASA IV - Threat to life</option>
                      <option value={5}>ASA V - Moribund</option>
                      <option value={6}>ASA VI - Brain-dead organ donor</option>
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1 font-urdu">
                      {ASA_CLASSES[asaClass]?.ur}
                    </p>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-rose-700">
                    <input
                      type="checkbox"
                      data-help="pre_anaesthesia_clinic.toggle_asa_emergency"
                      disabled={isFinal}
                      checked={asaEmergency}
                      onChange={(e) => setAsaEmergency(e.target.checked)}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span>Emergency Surgery Modifier (ASA-E)</span>
                  </label>

                  <div>
                    <label className="text-slate-700 font-semibold block">Planned Technique / اینستھیزیا طریقہ کار:</label>
                    <select
                      data-help="pre_anaesthesia_clinic.select_technique"
                      disabled={isFinal}
                      value={plannedTechnique}
                      onChange={(e) => setPlannedTechnique(e.target.value)}
                      className="w-full mt-1 p-2 border rounded bg-white text-slate-900 font-bold"
                    >
                      <option value="General">General Anaesthesia (GA)</option>
                      <option value="Spinal">Spinal Anaesthesia (SAB)</option>
                      <option value="Epidural">Epidural Anaesthesia</option>
                      <option value="Regional">Regional Nerve Block</option>
                      <option value="Sedation">Monitored Anaesthesia Care (Sedation)</option>
                      <option value="Local">Local Anaesthesia</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-600 font-semibold block">Fasting / NPO Instructions (hours):</label>
                    <input
                      type="text"
                      data-help="pre_anaesthesia_clinic.input_fasting"
                      disabled={isFinal}
                      value={fastingInstructions}
                      onChange={(e) => setFastingInstructions(e.target.value)}
                      placeholder="e.g. Solids 6h, Clear liquids 2h"
                      className="w-full mt-1 p-2 border rounded bg-white text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 font-semibold block">Anaesthesia Plan & Monitors:</label>
                    <textarea
                      data-help="pre_anaesthesia_clinic.input_plan"
                      disabled={isFinal}
                      value={planText}
                      onChange={(e) => setPlanText(e.target.value)}
                      placeholder="Airway device (ETT/LMA), invasive lines, analgesic plan..."
                      rows={2}
                      className="w-full mt-1 p-2 border rounded bg-white text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 font-semibold block">Identified Anaesthetic Risks / متوقع خطرات:</label>
                    <textarea
                      data-help="pre_anaesthesia_clinic.input_risks"
                      disabled={isFinal}
                      value={risksText}
                      onChange={(e) => setRisksText(e.target.value)}
                      placeholder="Cardiovascular instability, aspiration, difficult airway..."
                      rows={2}
                      className="w-full mt-1 p-2 border rounded bg-white text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 font-semibold block">Premedication Orders / پری میڈیکیشن ہدایات:</label>
                    <input
                      type="text"
                      data-help="pre_anaesthesia_clinic.input_premedication"
                      disabled={isFinal}
                      value={premedicationText}
                      onChange={(e) => setPremedicationText(e.target.value)}
                      placeholder="e.g. Oral diazepam 5mg, pantoprazole 40mg at 06:00"
                      className="w-full mt-1 p-2 border rounded bg-white text-slate-900"
                    />
                  </div>

                  {/* Fitness Decision (Rule a91aa7215a) */}
                  <div className="pt-2 border-t border-slate-200">
                    <label className="text-slate-800 font-bold block text-sm">
                      Fitness Clearance Decision / حتمی فیصلہ:
                    </label>
                    <select
                      data-help="pre_anaesthesia_clinic.select_decision"
                      disabled={isFinal}
                      value={decision}
                      onChange={(e) => setDecision(e.target.value)}
                      className={`w-full mt-1 p-2 border rounded text-xs font-bold ${
                        decision === "Fit"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : decision === "FitWithConditions"
                          ? "bg-blue-50 text-blue-800 border-blue-300"
                          : decision === "Deferred"
                          ? "bg-amber-50 text-amber-800 border-amber-300"
                          : "bg-rose-50 text-rose-800 border-rose-300"
                      }`}
                    >
                      <option value="Fit">Fit for Surgery (مکمل فٹ)</option>
                      <option value="FitWithConditions">Fit with Conditions (مشروط فٹ)</option>
                      <option value="Deferred">Deferred for Optimization (موخر برائے بہتری)</option>
                      <option value="NotFit">Not Fit (سرجری کے لیے غیر موزوں)</option>
                    </select>
                  </div>

                  {decision !== "Fit" && (
                    <div>
                      <label className="text-rose-700 font-bold block text-xs">
                        Decision Note (Required per Rule a91aa7215a):
                      </label>
                      <textarea
                        data-help="pre_anaesthesia_clinic.input_decision_note"
                        disabled={isFinal}
                        value={decisionNote}
                        onChange={(e) => setDecisionNote(e.target.value)}
                        placeholder="State clinical reasons, required optimization, or conditions..."
                        rows={2}
                        className="w-full mt-1 p-2 border border-rose-300 rounded bg-rose-50/20 text-slate-900"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {!isFinal ? (
                <>
                  <button
                    data-help="pre_anaesthesia_clinic.save_draft_button"
                    onClick={handleSaveDraft}
                    disabled={loading}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition"
                  >
                    Save Draft / محفوظ کریں
                  </button>

                  <button
                    data-help="pre_anaesthesia_clinic.sign_assessment_button"
                    onClick={handleSignAssessment}
                    disabled={loading}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow transition"
                  >
                    Sign Assessment / باضابطہ دستخط کریں
                  </button>
                </>
              ) : (
                <>
                  <button
                    data-help="pre_anaesthesia_clinic.reassess_button"
                    onClick={handleReassess}
                    disabled={loading}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow transition"
                  >
                    Reassess (New Assessment) / دوبارہ جائزہ لیں
                  </button>

                  <button
                    data-help="pre_anaesthesia_clinic.generate_consent_button"
                    onClick={handleGenerateConsent}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow transition"
                  >
                    Prepare Anaesthesia Consent (رضامندی فارم)
                  </button>
                </>
              )}
            </div>

            <div className="text-xs text-slate-500 font-mono">
              Version: {currentVersion} {isFinal && "| Final & Signed"}
            </div>
          </div>
        </div>
      )}

      {/* CONSENT MODAL (Rule d5b2105887) */}
      {showConsentModal && activeConsent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-base font-bold text-slate-900">
                Anaesthesia Consent (#{activeConsent.consent_number})
              </h2>
              <button
                data-help="pre_anaesthesia_clinic.close_consent_modal_button"
                onClick={() => setShowConsentModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-2 text-slate-700">
              <p>
                <strong>Technique:</strong> {plannedTechnique} Anaesthesia
              </p>
              <p>
                <strong>Status:</strong> <span className="font-semibold">{activeConsent.status}</span>
              </p>
              <p className="text-slate-500">
                Patient informed of common risks, emergency conversions, and post-anaesthesia care.
              </p>

              {activeConsent.status !== "Given" && activeConsent.status !== "Refused" && (
                <div className="pt-2 border-t">
                  <label className="block text-slate-600 font-semibold mb-1">
                    If refusing, enter refusal reason:
                  </label>
                  <input
                    type="text"
                    data-help="pre_anaesthesia_clinic.input_consent_refusal_reason"
                    value={consentRefuseReason}
                    onChange={(e) => setConsentRefuseReason(e.target.value)}
                    placeholder="Patient declines consent for this technique..."
                    className="w-full p-2 border rounded text-xs bg-white text-slate-900"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t">
              <button
                data-help="pre_anaesthesia_clinic.print_consent_button"
                onClick={handlePrintConsent}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Print Consent / پرنٹ
              </button>

              {activeConsent.status !== "Given" && activeConsent.status !== "Refused" && (
                <>
                  <button
                    data-help="pre_anaesthesia_clinic.refuse_consent_button"
                    onClick={handleRefuseConsent}
                    disabled={loading}
                    className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-semibold"
                  >
                    Refuse / انکار
                  </button>

                  <button
                    data-help="pre_anaesthesia_clinic.sign_consent_button"
                    onClick={handleSignConsent}
                    disabled={loading}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                  >
                    Sign Consent / دستخط کریں
                  </button>
                </>
              )}

              <button
                data-help="pre_anaesthesia_clinic.close_consent_modal_button"
                onClick={() => setShowConsentModal(false)}
                className="px-3 py-1.5 border rounded-lg text-xs text-slate-600"
              >
                Close / بند کریں
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
