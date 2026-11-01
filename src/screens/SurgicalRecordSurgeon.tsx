import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { EstablishmentOut } from "../generated/facility_profile";
import type {
  SurgicalRecordOut,
  SurgicalWorklistItemOut,
  PreOpNoteIn,
  OperativeNoteIn,
  ConsentIn,
  ConsentUpdateIn,
  ConsentSignIn,
  ConsentRefuseIn,
  SurgicalCorrectionIn,
  IncidentIn,
  IcdTermOut,
  IcdSearchItemOut,
  ConsentFormOut,
  DecisionMakerOut,
} from "../generated/surgical_record_surgeon";
import {
  worklistOtClinical,
  getRecord as getSurgicalRecord,
  preOpNote as savePreOpNote,
  writeOperativeNote as saveOperativeNote,
  signOperativeNote,
  printRecord,
  correct as addCorrection,
  reportIncidents,
  searchIcdCodes,
  listForms as listConsentForms,
  listDecisionMakers,
  createConsents,
  update as updateConsent,
  sign as signConsent,
  refuse as refuseConsent,
  printConsent,
} from "../generated/surgical_record_surgeon";
import {
  listTypes as listIncidentTypes,
  IncidentTypeOut,
} from "../generated/safety_checklist";
import {
  getSurgicalRecordSurgeonScreenView,
  canViewSurgicalRecord,
  canRecordPreOpNote,
  canRecordOperativeNote,
  canManageConsents,
  canCorrectSurgicalRecord,
  canReportIncident,
  validatePreOpNote,
  validateOperativeNoteDraft,
  validateOperativeNoteSigning,
  validateCorrectionInput,
  validateIncidentInput,
  explainSurgicalRecordSurgeonError,
  LATERALITY_OPTIONS,
  WOUND_CLASSES,
  CONDITIONS_AT_END,
  ClinicalUser,
} from "../surgical-record-surgeon-policy";

export interface SurgicalRecordSurgeonProps {
  establishment?: EstablishmentOut | null;
  currentUser?: ClinicalUser | null;
  connected?: boolean;
  stream?: any;
  timeZone?: string;
  screenId?: string;
  onNavigate?: (screenId: string) => void;
  onNavigateScreen?: (screenId: string) => void;
}

export const SurgicalRecordSurgeon: React.FC<SurgicalRecordSurgeonProps> = ({
  establishment,
  currentUser,
  connected = true,
  stream,
  timeZone = "Asia/Karachi",
  screenId = "surgical_record_surgeon",
  onNavigate,
  onNavigateScreen,
}) => {
  const viewMode = getSurgicalRecordSurgeonScreenView(establishment, screenId);
  const canView = canViewSurgicalRecord(currentUser);
  const canPreOp = canRecordPreOpNote(currentUser);
  const canOpNote = canRecordOperativeNote(currentUser);
  const canConsent = canManageConsents(currentUser);
  const canCorrect = canCorrectSurgicalRecord(currentUser);
  const canReport = canReportIncident(currentUser);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"preop" | "consent" | "opnote" | "overview">("preop");

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

  // Tab 1: Pre-Op Note State
  const [preopHistory, setPreopHistory] = useState<string>("");
  const [preopDiagnosis, setPreopDiagnosis] = useState<string>("");
  const [preopIcdSearch, setPreopIcdSearch] = useState<string>("");
  const [icdResults, setIcdResults] = useState<IcdSearchItemOut[]>([]);
  const [selectedIcdCodes, setSelectedIcdCodes] = useState<string[]>([]);
  const [preopPlan, setPreopPlan] = useState<string>("");
  const [preopLaterality, setPreopLaterality] = useState<"Left" | "Right" | "Bilateral" | "NotApplicable">("NotApplicable");

  // Tab 2: Operation Consent State
  const [consentForms, setConsentForms] = useState<ConsentFormOut[]>([]);
  const [decisionMakers, setDecisionMakers] = useState<DecisionMakerOut[]>([]);
  const [consentProcedure, setConsentProcedure] = useState<string>("");
  const [consentPerformer, setConsentPerformer] = useState<string>("");
  const [consentLanguage, setConsentLanguage] = useState<string>("en");
  const [consentRisks, setConsentRisks] = useState<string>("");
  const [consentBenefits, setConsentBenefits] = useState<string>("");
  const [consentAlternatives, setConsentAlternatives] = useState<string>("");
  const [consentReadAloud, setConsentReadAloud] = useState<boolean>(true);

  // Modals for Consent Signing / Refusal
  const [showSignConsentModal, setShowSignConsentModal] = useState<boolean>(false);
  const [signDecisionMakerRel, setSignDecisionMakerRel] = useState<string>("Self");
  const [signSignerName, setSignSignerName] = useState<string>("");
  const [signSignerCnic, setSignSignerCnic] = useState<string>("");
  const [signMethod, setSignMethod] = useState<"Signature" | "ThumbImpression">("Signature");
  const [signWitnessName, setSignWitnessName] = useState<string>("");
  const [signWitnessCnic, setSignWitnessCnic] = useState<string>("");

  const [showRefuseConsentModal, setShowRefuseConsentModal] = useState<boolean>(false);
  const [refuseReason, setRefuseReason] = useState<string>("");
  const [refuseWitness, setRefuseWitness] = useState<string>("");

  // Tab 3: Operative Note State
  const [opPostOpDiag, setOpPostOpDiag] = useState<string>("");
  const [opProcPerformed, setOpProcPerformed] = useState<string>("");
  const [opIncision, setOpIncision] = useState<string>("");
  const [opFindings, setOpFindings] = useState<string>("");
  const [opTechnique, setOpTechnique] = useState<string>("");
  const [opWoundClass, setOpWoundClass] = useState<"Clean" | "CleanContaminated" | "Contaminated" | "Dirty">("CleanContaminated");
  const [opImplants, setOpImplants] = useState<string>("");
  const [opImplantLeft, setOpImplantLeft] = useState<boolean>(false);
  const [opHistopathology, setOpHistopathology] = useState<boolean>(false);
  const [opSpecimens, setOpSpecimens] = useState<string>("");
  const [opDrains, setOpDrains] = useState<string>("");
  const [opClosure, setOpClosure] = useState<string>("");
  const [opBloodLoss, setOpBloodLoss] = useState<string>("");
  const [opTransfusion, setOpTransfusion] = useState<string>("");
  const [opUnexpected, setOpUnexpected] = useState<string>("");
  const [opConditionEnd, setOpConditionEnd] = useState<"Stable" | "Satisfactory" | "Guarded" | "Critical">("Stable");

  // Post-Op Care Plan
  const [opMonitoring, setOpMonitoring] = useState<string>("Vital signs q15min for 2 hours, then q1h.");
  const [opMonitoringInterval, setOpMonitoringInterval] = useState<string>("60");
  const [opMedications, setOpMedications] = useState<string>("IV analgesics as prescribed; prophylactic antibiotics as indicated.");
  const [opWoundCare, setOpWoundCare] = useState<string>("Sterile surgical dressing intact; inspect soakage.");
  const [opDrainsCatheters, setOpDrainsCatheters] = useState<string>("Not needed");
  const [opNutrition, setOpNutrition] = useState<string>("NPO for 4 hours post-op, then clear fluids as tolerated.");
  const [opFluidBalance, setOpFluidBalance] = useState<string>("IV maintenance fluids 1000ml / 24h.");
  const [opReferrals, setOpReferrals] = useState<string>("Not needed");

  // Tab 4: Modals for Corrections & Incidents
  const [showCorrectionModal, setShowCorrectionModal] = useState<boolean>(false);
  const [corrRecordPart, setCorrRecordPart] = useState<"PreOpNote" | "OperativeNote">("OperativeNote");
  const [corrText, setCorrText] = useState<string>("");
  const [corrReason, setCorrReason] = useState<string>("");

  const [showIncidentModal, setShowIncidentModal] = useState<boolean>(false);
  const [incidentTypesList, setIncidentTypesList] = useState<IncidentTypeOut[]>([]);
  const [selectedIncidentTypeCode, setSelectedIncidentTypeCode] = useState<string>("");
  const [incidentSummary, setIncidentSummary] = useState<string>("");

  // Validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Active note states
  const preOp = surgicalRecord?.pre_op_note;
  const opNote = surgicalRecord?.operative_note;
  const isOpNoteFinal = opNote?.status === "Final";
  const booking = surgicalRecord?.booking;

  // Active operation consent
  const opConsentBrief = surgicalRecord?.consents?.find((c) => c.form_code === "OPERATION");

  // Load candidate worklist
  const loadWorklist = useCallback(async () => {
    try {
      setLoading(true);
      setErrorBanner(null);
      const data = await worklistOtClinical({ days: 7 });
      setWorklist(data);
      if (data.length > 0 && selectedBookingId === null) {
        setSelectedBookingId(data[0].booking_id);
      }
    } catch (err: any) {
      setErrorBanner(explainSurgicalRecordSurgeonError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  }, [selectedBookingId]);

  // Load full record
  const loadRecord = useCallback(async (bookingId: number) => {
    try {
      setLoading(true);
      setErrorBanner(null);
      const rec = await getSurgicalRecord(bookingId);
      setSurgicalRecord(rec);

      // Pre-op note
      if (rec.pre_op_note) {
        setPreopHistory(rec.pre_op_note.history_examination || "");
        setPreopDiagnosis(rec.pre_op_note.provisional_diagnosis || "");
        setPreopPlan(rec.pre_op_note.operation_plan || "");
        setPreopLaterality(rec.pre_op_note.laterality || "NotApplicable");
        setSelectedIcdCodes(rec.pre_op_note.icd_codes || []);
      } else {
        setPreopHistory("");
        setPreopDiagnosis("");
        setPreopPlan(rec.booking.procedure_name || "");
        setPreopLaterality("NotApplicable");
        setSelectedIcdCodes([]);
      }

      // Operative note
      if (rec.operative_note) {
        setOpPostOpDiag(rec.operative_note.post_op_diagnosis || "");
        setOpProcPerformed(rec.operative_note.procedure_performed || rec.booking.procedure_name || "");
        setOpIncision(rec.operative_note.incision || "");
        setOpFindings(rec.operative_note.findings || "");
        setOpTechnique(rec.operative_note.procedure_details || "");
        setOpWoundClass(rec.operative_note.wound_class || "CleanContaminated");
        setOpImplants(rec.operative_note.implants || "");
        setOpImplantLeft(Boolean(rec.operative_note.implant_left));
        setOpHistopathology(Boolean(rec.operative_note.histopathology_sent));
        setOpSpecimens(rec.operative_note.specimens || "");
        setOpDrains(rec.operative_note.drains || "");
        setOpClosure(rec.operative_note.closure || "");
        setOpBloodLoss(rec.operative_note.blood_loss_ml !== null ? String(rec.operative_note.blood_loss_ml) : "");
        setOpTransfusion(rec.operative_note.transfusion || "");
        setOpUnexpected(rec.operative_note.unexpected_events || "");
        setOpConditionEnd(rec.operative_note.condition_at_end || "Stable");

        setOpMonitoring(rec.operative_note.monitoring || "Vital signs q15min for 2 hours, then q1h.");
        setOpMonitoringInterval(
          rec.operative_note.monitoring_interval_minutes !== null ? String(rec.operative_note.monitoring_interval_minutes) : "60"
        );
        setOpMedications(rec.operative_note.medications || "IV analgesics as prescribed; prophylactic antibiotics as indicated.");
        setOpWoundCare(rec.operative_note.wound_care || "Sterile surgical dressing intact; inspect soakage.");
        setOpDrainsCatheters(rec.operative_note.drains_catheters || "Not needed");
        setOpNutrition(rec.operative_note.nutrition || "NPO for 4 hours post-op, then clear fluids as tolerated.");
        setOpFluidBalance(rec.operative_note.fluid_balance || "IV maintenance fluids 1000ml / 24h.");
        setOpReferrals(rec.operative_note.referrals || "Not needed");
      } else {
        // Pre-fill from booking & pre-op note
        setOpPostOpDiag(rec.pre_op_note?.provisional_diagnosis || "");
        setOpProcPerformed(rec.booking.procedure_name || "");
        setOpIncision("");
        setOpFindings("");
        setOpTechnique("");
        setOpWoundClass("CleanContaminated");
        setOpImplants("");
        setOpImplantLeft(false);
        setOpHistopathology(false);
        setOpSpecimens("");
        setOpDrains("");
        setOpClosure("");
        setOpBloodLoss("");
        setOpTransfusion("");
        setOpUnexpected("");
        setOpConditionEnd("Stable");

        setOpMonitoring("Vital signs q15min for 2 hours, then q1h.");
        setOpMonitoringInterval("60");
        setOpMedications("IV analgesics as prescribed; prophylactic antibiotics as indicated.");
        setOpWoundCare("Sterile surgical dressing intact; inspect soakage.");
        setOpDrainsCatheters("Not needed");
        setOpNutrition("NPO for 4 hours post-op, then clear fluids as tolerated.");
        setOpFluidBalance("IV maintenance fluids 1000ml / 24h.");
        setOpReferrals("Not needed");
      }

      // Pre-fill consent fields
      setConsentProcedure(rec.booking.procedure_name || "");
      setConsentPerformer(rec.booking.surgeon_name || "");
    } catch (err: any) {
      setErrorBanner(explainSurgicalRecordSurgeonError(err?.code || "INTERNAL_ERROR", err?.details));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadWorklist();
  }, [loadWorklist]);

  // Load record when selected booking changes
  useEffect(() => {
    if (selectedBookingId) {
      loadRecord(selectedBookingId);
    }
  }, [selectedBookingId, loadRecord]);

  // Load metadata for forms
  useEffect(() => {
    listConsentForms().then(setConsentForms).catch(() => {});
    listDecisionMakers().then(setDecisionMakers).catch(() => {});
  }, []);

  // Load incident types when modal opens
  useEffect(() => {
    if (showIncidentModal && incidentTypesList.length === 0) {
      listIncidentTypes({ area: "Surgery", active_only: true })
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
    } catch {}
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

  // Search ICD codes
  const handleIcdSearch = async (query: string) => {
    setPreopIcdSearch(query);
    if (query.trim().length >= 2) {
      try {
        const results = await searchIcdCodes({ q: query, limit: 10 });
        setIcdResults(results.items || []);
      } catch {
        setIcdResults([]);
      }
    } else {
      setIcdResults([]);
    }
  };

  // Add ICD code
  const handleSelectIcd = (code: string) => {
    if (!selectedIcdCodes.includes(code)) {
      setSelectedIcdCodes([...selectedIcdCodes, code]);
    }
    setPreopIcdSearch("");
    setIcdResults([]);
  };

  // Remove ICD code
  const handleRemoveIcd = (code: string) => {
    setSelectedIcdCodes(selectedIcdCodes.filter((c) => c !== code));
  };

  // Save Pre-Op Note
  const handleSavePreOpNote = async () => {
    if (!selectedBookingId || !canPreOp) return;
    setFormErrors({});

    const body: PreOpNoteIn = {
      history_examination: preopHistory.trim(),
      provisional_diagnosis: preopDiagnosis.trim(),
      operation_plan: preopPlan.trim(),
      laterality: preopLaterality,
      icd_codes: selectedIcdCodes,
    };

    const val = validatePreOpNote(body);
    if (!val.valid) {
      setFormErrors(val.errors);
      return;
    }

    try {
      setSubmitting(true);
      setErrorBanner(null);
      const updated = await savePreOpNote(selectedBookingId, body);
      setSurgicalRecord(updated);
      setSuccessBanner("Surgeon's pre-operative clinical note saved successfully.");
      setTimeout(() => setSuccessBanner(null), 3000);
    } catch (err: any) {
      setErrorBanner(explainSurgicalRecordSurgeonError(err?.code, err?.details));
    } finally {
      setSubmitting(false);
    }
  };

  // Save / Prepare Operation Consent
  const handleSaveConsent = async () => {
    if (!selectedBookingId || !canConsent) return;
    setFormErrors({});

    if (!consentRisks.trim() || !consentBenefits.trim() || !consentAlternatives.trim()) {
      setErrorBanner({
        en: "Risks, benefits, and surgical alternatives are mandatory for informed consent (Rule 451c4b4945).",
        ur: "باخبر رضامندی کے لیے خطرات، فوائد اور متبادل طریقے درج کرنا لازمی ہے۔",
      });
      return;
    }

    try {
      setSubmitting(true);
      setErrorBanner(null);

      if (opConsentBrief && opConsentBrief.status === "Draft") {
        // Update existing consent draft
        const patch: ConsentUpdateIn = {
          procedure_name: consentProcedure.trim(),
          performer_name: consentPerformer.trim(),
          risks: consentRisks.trim(),
          benefits: consentBenefits.trim(),
          alternatives: consentAlternatives.trim(),
          language: consentLanguage as any,
        };
        await updateConsent(opConsentBrief.consent_id, patch);
      } else {
        // Create new operation consent
        const createIn: ConsentIn = {
          patient_id: surgicalRecord!.booking.patient_id,
          booking_id: selectedBookingId,
          form_code: "OPERATION",
          procedure_name: consentProcedure.trim(),
          performer_name: consentPerformer.trim(),
          language: consentLanguage as any,
          risks: consentRisks.trim(),
          benefits: consentBenefits.trim(),
          alternatives: consentAlternatives.trim(),
        };
        await createConsents(createIn);
      }

      setSuccessBanner("Operation consent prepared successfully.");
      setTimeout(() => setSuccessBanner(null), 3000);
      loadRecord(selectedBookingId);
    } catch (err: any) {
      setErrorBanner(explainSurgicalRecordSurgeonError(err?.code, err?.details));
    } finally {
      setSubmitting(false);
    }
  };

  // Sign Operation Consent
  const handleSignConsentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opConsentBrief) return;

    const signIn: ConsentSignIn = {
      signer: signDecisionMakerRel === "Self" ? "Patient" : "DecisionMaker",
      signer_relationship: (signDecisionMakerRel === "Self" ? null : signDecisionMakerRel) as any,
      signer_name: signSignerName.trim() || surgicalRecord!.booking.patient_name,
      signer_cnic: signSignerCnic.trim() || null,
      signer_mark: signMethod,
      witness_name: signWitnessName.trim() || null,
      understanding_confirmed: true,
      questions_answers: "None asked",
      mode: "Signed",
    };

    try {
      setSubmitting(true);
      setErrorBanner(null);
      await signConsent(opConsentBrief.consent_id, signIn);
      setShowSignConsentModal(false);
      setSuccessBanner("Operation consent signed and recorded as Given.");
      setTimeout(() => setSuccessBanner(null), 3000);
      loadRecord(selectedBookingId!);
    } catch (err: any) {
      setErrorBanner(explainSurgicalRecordSurgeonError(err?.code, err?.details));
    } finally {
      setSubmitting(false);
    }
  };

  // Refuse Operation Consent
  const handleRefuseConsentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opConsentBrief) return;

    const refuseIn: ConsentRefuseIn = {
      mode: "VerbalRefusal",
      refusal_reason: refuseReason.trim(),
      witness_name: refuseWitness.trim() || null,
      questions_answers: "Refusal against medical advice",
    };

    try {
      setSubmitting(true);
      setErrorBanner(null);
      await refuseConsent(opConsentBrief.consent_id, refuseIn);
      setShowRefuseConsentModal(false);
      setSuccessBanner("Informed surgical refusal recorded.");
      setTimeout(() => setSuccessBanner(null), 3000);
      loadRecord(selectedBookingId!);
    } catch (err: any) {
      setErrorBanner(explainSurgicalRecordSurgeonError(err?.code, err?.details));
    } finally {
      setSubmitting(false);
    }
  };

  // Print Consent
  const handlePrintConsent = async () => {
    if (!opConsentBrief) return;
    try {
      setLoading(true);
      const payload = await printConsent(opConsentBrief.consent_id);
      if (payload?.text) {
        window.print();
      }
    } catch (err: any) {
      setErrorBanner(explainSurgicalRecordSurgeonError(err?.code, err?.details));
    } finally {
      setLoading(false);
    }
  };

  // Save Operative Note Draft
  const handleSaveOperativeNote = async () => {
    if (!selectedBookingId || !canOpNote) return;
    setFormErrors({});

    const body: OperativeNoteIn = {
      post_op_diagnosis: opPostOpDiag.trim(),
      procedure_performed: opProcPerformed.trim(),
      incision: opIncision.trim() || null,
      findings: opFindings.trim(),
      procedure_details: opTechnique.trim(),
      wound_class: opWoundClass,
      implants: opImplants.trim() || null,
      implant_left: opImplantLeft,
      histopathology_sent: opHistopathology,
      specimens: opSpecimens.trim() || null,
      drains: opDrains.trim() || null,
      closure: opClosure.trim() || null,
      blood_loss_ml: opBloodLoss ? Number(opBloodLoss) : null,
      transfusion: opTransfusion.trim() || null,
      unexpected_events: opUnexpected.trim() || null,
      condition_at_end: opConditionEnd,

      monitoring: opMonitoring.trim() || null,
      monitoring_interval_minutes: opMonitoringInterval ? Number(opMonitoringInterval) : null,
      medications: opMedications.trim() || null,
      wound_care: opWoundCare.trim() || null,
      drains_catheters: opDrainsCatheters.trim() || null,
      nutrition: opNutrition.trim() || null,
      fluid_balance: opFluidBalance.trim() || null,
      referrals: opReferrals.trim() || null,
      expected_version: opNote?.row_version,
    };

    const val = validateOperativeNoteDraft(body);
    if (!val.valid) {
      setFormErrors(val.errors);
      return;
    }

    try {
      setSubmitting(true);
      setErrorBanner(null);
      const updated = await saveOperativeNote(selectedBookingId, body);
      setSurgicalRecord(updated);
      setSuccessBanner("Operative note draft and post-operative plan saved.");
      setTimeout(() => setSuccessBanner(null), 3000);
    } catch (err: any) {
      setErrorBanner(explainSurgicalRecordSurgeonError(err?.code, err?.details));
    } finally {
      setSubmitting(false);
    }
  };

  // Sign Operative Note
  const handleSignOperativeNote = async () => {
    if (!selectedBookingId || !canOpNote) return;

    const draftState: Partial<OperativeNoteIn> = {
      procedure_performed: opProcPerformed,
      post_op_diagnosis: opPostOpDiag,
      findings: opFindings,
      procedure_details: opTechnique,
      wound_class: opWoundClass,
      condition_at_end: opConditionEnd,
      monitoring: opMonitoring,
      monitoring_interval_minutes: opMonitoringInterval ? Number(opMonitoringInterval) : null,
      medications: opMedications,
      wound_care: opWoundCare,
      nutrition: opNutrition,
      fluid_balance: opFluidBalance,
    };

    const signCheck = validateOperativeNoteSigning(opNote, draftState);
    if (!signCheck.canSign) {
      setErrorBanner({
        en: `Cannot sign operative note. Missing: ${signCheck.missing.join(", ")}`,
        ur: `آپریٹو نوٹ پر دستخط ممکن نہیں۔ درج ذیل خانے پر کریں: ${signCheck.missing.join("، ")}`,
      });
      return;
    }

    try {
      setSubmitting(true);
      setErrorBanner(null);
      const updated = await signOperativeNote(selectedBookingId, {
        expected_version: opNote?.row_version,
      });
      setSurgicalRecord(updated);
      setSuccessBanner("Operative note finalized and signed.");
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err: any) {
      setErrorBanner(explainSurgicalRecordSurgeonError(err?.code, err?.details));
    } finally {
      setSubmitting(false);
    }
  };

  // Print Full Surgical Record
  const handlePrintRecord = async () => {
    if (!selectedBookingId) return;
    try {
      setLoading(true);
      const payload = await printRecord(selectedBookingId);
      if (payload?.text) {
        window.print();
      }
    } catch (err: any) {
      setErrorBanner(explainSurgicalRecordSurgeonError(err?.code, err?.details));
    } finally {
      setLoading(false);
    }
  };

  // Submit Correction Addendum
  const handleAddCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingId) return;

    const corrData: SurgicalCorrectionIn = {
      record: corrRecordPart,
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
      setErrorBanner(explainSurgicalRecordSurgeonError(err?.code, err?.details));
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Incident Report
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
      setErrorBanner(explainSurgicalRecordSurgeonError(err?.code, err?.details));
    } finally {
      setSubmitting(false);
    }
  };

  if (viewMode === "hidden") {
    return (
      <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
        <h2 className="text-xl font-bold">Surgical Record Unavailable</h2>
        <p>The surgery service is currently inactive or hidden under this facility configuration.</p>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-gray-900">Surgical Record: Pre-Operative & Operative Notes</h1>
          <p className="text-sm text-gray-600">
            Surgeon clinical journey: pre-op evaluation, operation consent, operative note, and post-op care orders (MSDS COP 31, 32, 34, 38, 40).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search cases (name, MRN, procedure)..."
            value={caseSearch}
            onChange={(e) => setCaseSearch(e.target.value)}
            className="px-3 py-1.5 border rounded-md text-sm w-64"
            data-help="surgical_record_surgeon.case_search"
          />

          <select
            value={selectedBookingId || ""}
            onChange={(e) => setSelectedBookingId(Number(e.target.value))}
            className="px-3 py-1.5 border rounded-md text-sm bg-white"
            data-help="surgical_record_surgeon.case_select"
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
            <span className="text-gray-500 block text-xs">Operative Status</span>
            <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">
              {booking.status}
            </span>
          </div>
        </div>
      )}

      {/* Surgical Record Parts Stepper Strip (Rule 3e99378238) */}
      {surgicalRecord && (
        <div className="bg-white border rounded-lg p-3 space-y-2">
          <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Surgical Record Parts Stepper
          </div>
          <div className="flex flex-wrap gap-2">
            {surgicalRecord.parts.map((p) => (
              <div
                key={p.part}
                className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${
                  p.state === "Final"
                    ? "bg-green-100 text-green-800 border-green-300"
                    : p.state === "Draft"
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : "bg-gray-100 text-gray-600 border-gray-300"
                }`}
              >
                <span>{p.state === "Final" ? "✓" : p.state === "Draft" ? "✎" : "○"}</span>
                <span>{p.label}</span>
                <span className="text-[10px] opacity-75">({p.state})</span>
              </div>
            ))}
          </div>
          {surgicalRecord.next_step && (
            <div className="text-xs text-indigo-800 bg-indigo-50 p-2 rounded border border-indigo-200 mt-2">
              <span className="font-semibold">Next Clinical Action:</span> {surgicalRecord.next_step}
            </div>
          )}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b">
        <button
          type="button"
          onClick={() => setActiveTab("preop")}
          className={`py-2 px-4 text-sm font-medium border-b-2 ${
            activeTab === "preop"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          data-help="surgical_record_surgeon.tab_preop"
        >
          1. Pre-Op Clinical Note {Boolean(preOp?.recorded_at) && "✓"}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("consent")}
          className={`py-2 px-4 text-sm font-medium border-b-2 ${
            activeTab === "consent"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          data-help="surgical_record_surgeon.tab_consent"
        >
          2. Operation Consent {opConsentBrief?.status === "Given" && "✓"}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("opnote")}
          className={`py-2 px-4 text-sm font-medium border-b-2 ${
            activeTab === "opnote"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          data-help="surgical_record_surgeon.tab_opnote"
        >
          3. Operative Note & Post-Op Plan {isOpNoteFinal && "✓"}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`py-2 px-4 text-sm font-medium border-b-2 ${
            activeTab === "overview"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          data-help="surgical_record_surgeon.tab_overview"
        >
          4. Record Overview & Audit
        </button>
      </div>

      {/* TAB 1: Pre-Op Clinical Note (Rule 8bbdbdc51d) */}
      {activeTab === "preop" && (
        <div className="bg-white border rounded-lg p-5 shadow-sm space-y-4">
          <div className="border-b pb-2">
            <h2 className="text-lg font-bold text-gray-900">Surgeon's Pre-Operative Note</h2>
            <p className="text-xs text-gray-600">
              Mandatory clinical evaluation, provisional diagnosis, ICD-10 mapping, and surgical site marking (Rule 8bbdbdc51d).
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-700">History & Clinical Examination *</label>
              <textarea
                value={preopHistory}
                onChange={(e) => setPreopHistory(e.target.value)}
                disabled={!canPreOp || viewMode === "records"}
                rows={3}
                placeholder="Presenting complaint, duration, clinical examination findings, vitals..."
                className="w-full px-3 py-2 border rounded text-sm mt-1"
                data-help="surgical_record_surgeon.preop_history"
              />
              {formErrors.history_examination && (
                <p className="text-xs text-red-600 mt-0.5">{formErrors.history_examination}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700">Provisional Diagnosis *</label>
                <input
                  type="text"
                  value={preopDiagnosis}
                  onChange={(e) => setPreopDiagnosis(e.target.value)}
                  disabled={!canPreOp || viewMode === "records"}
                  placeholder="e.g. Acute appendicitis, Cholelithiasis..."
                  className="w-full px-3 py-2 border rounded text-sm mt-1"
                  data-help="surgical_record_surgeon.preop_diagnosis"
                />
                {formErrors.provisional_diagnosis && (
                  <p className="text-xs text-red-600 mt-0.5">{formErrors.provisional_diagnosis}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Surgical Laterality / Site Marking *</label>
                <select
                  value={preopLaterality}
                  onChange={(e) => setPreopLaterality(e.target.value as any)}
                  disabled={!canPreOp || viewMode === "records"}
                  className="w-full px-3 py-2 border rounded text-sm mt-1 bg-white"
                  data-help="surgical_record_surgeon.preop_laterality"
                >
                  {LATERALITY_OPTIONS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
                {formErrors.laterality && (
                  <p className="text-xs text-red-600 mt-0.5">{formErrors.laterality}</p>
                )}
              </div>
            </div>

            {/* ICD-10 Search & Picker */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-700">ICD-10 Diagnostic Classification</label>
              <div className="relative">
                <input
                  type="text"
                  value={preopIcdSearch}
                  onChange={(e) => handleIcdSearch(e.target.value)}
                  disabled={!canPreOp || viewMode === "records"}
                  placeholder="Search ICD-10 codes or disease terms (e.g. K35, cholecystitis)..."
                  className="w-full px-3 py-2 border rounded text-sm"
                  data-help="surgical_record_surgeon.preop_icd_search"
                />
                {icdResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border rounded shadow-lg max-h-48 overflow-y-auto z-20 mt-1">
                    {icdResults.map((r) => (
                      <button
                        key={r.code}
                        type="button"
                        onClick={() => handleSelectIcd(r.code)}
                        className="w-full text-left p-2 text-xs hover:bg-indigo-50 border-b flex justify-between"
                        data-help="surgical_record_surgeon.preop_icd_select"
                      >
                        <span className="font-bold text-indigo-700">{r.code}</span>
                        <span className="text-gray-700">{r.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedIcdCodes.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedIcdCodes.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded text-xs font-mono"
                    >
                      <span>{c}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveIcd(c)}
                        disabled={!canPreOp || viewMode === "records"}
                        data-help="surgical_record_surgeon.preop_icd_select"
                        className="text-gray-400 hover:text-red-600 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700">Proposed Operation Plan & Technique *</label>
              <textarea
                value={preopPlan}
                onChange={(e) => setPreopPlan(e.target.value)}
                disabled={!canPreOp || viewMode === "records"}
                rows={3}
                placeholder="Planned procedure, surgical approach, special equipment or implants required..."
                className="w-full px-3 py-2 border rounded text-sm mt-1"
                data-help="surgical_record_surgeon.preop_plan"
              />
              {formErrors.operation_plan && (
                <p className="text-xs text-red-600 mt-0.5">{formErrors.operation_plan}</p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSavePreOpNote}
                disabled={!canPreOp || submitting || viewMode === "records"}
                className="px-6 py-2 bg-indigo-600 text-white rounded text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                data-help="surgical_record_surgeon.save_preop_btn"
              >
                Save Pre-Operative Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Operation Consent (Rule 451c4b4945) */}
      {activeTab === "consent" && (
        <div className="bg-white border rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Informed Consent to Operation</h2>
              <p className="text-xs text-gray-600">
                Statutory risk-benefit counseling, vernacular explanation, and decision-maker signature (Rule 451c4b4945).
              </p>
            </div>

            <div className="flex items-center gap-2">
              {opConsentBrief && (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    opConsentBrief.status === "Given"
                      ? "bg-green-100 text-green-800"
                      : opConsentBrief.status === "Refused"
                      ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  Consent: {opConsentBrief.status}
                </span>
              )}

              {opConsentBrief && (
                <button
                  type="button"
                  onClick={handlePrintConsent}
                  className="px-3 py-1.5 border rounded text-xs font-medium text-gray-700 hover:bg-gray-100"
                  data-help="surgical_record_surgeon.print_consent_btn"
                >
                  Print Consent (A4)
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700">Procedure Name *</label>
                <input
                  type="text"
                  value={consentProcedure}
                  onChange={(e) => setConsentProcedure(e.target.value)}
                  disabled={!canConsent || opConsentBrief?.status === "Given"}
                  className="w-full px-3 py-2 border rounded text-sm mt-1"
                  data-help="surgical_record_surgeon.consent_procedure"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Performer / Operating Surgeon *</label>
                <input
                  type="text"
                  value={consentPerformer}
                  onChange={(e) => setConsentPerformer(e.target.value)}
                  disabled={!canConsent || opConsentBrief?.status === "Given"}
                  className="w-full px-3 py-2 border rounded text-sm mt-1"
                  data-help="surgical_record_surgeon.consent_performer"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Vernacular Language</label>
                <select
                  value={consentLanguage}
                  onChange={(e) => setConsentLanguage(e.target.value)}
                  disabled={!canConsent || opConsentBrief?.status === "Given"}
                  className="w-full px-3 py-2 border rounded text-sm mt-1 bg-white"
                  data-help="surgical_record_surgeon.consent_language"
                >
                  <option value="en">English (انگریزی)</option>
                  <option value="ur">Urdu (اردو)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700">Material Surgical Risks Explained *</label>
              <textarea
                value={consentRisks}
                onChange={(e) => setConsentRisks(e.target.value)}
                disabled={!canConsent || opConsentBrief?.status === "Given"}
                rows={2}
                placeholder="Bleeding, infection, damage to adjacent structures, anaesthesia risks, conversion..."
                className="w-full px-3 py-2 border rounded text-sm mt-1"
                data-help="surgical_record_surgeon.consent_risks"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700">Expected Clinical Benefits *</label>
                <textarea
                  value={consentBenefits}
                  onChange={(e) => setConsentBenefits(e.target.value)}
                  disabled={!canConsent || opConsentBrief?.status === "Given"}
                  rows={2}
                  placeholder="Relief of symptoms, disease eradication, prevention of complications..."
                  className="w-full px-3 py-2 border rounded text-sm mt-1"
                  data-help="surgical_record_surgeon.consent_benefits"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Treatment Alternatives Discussed *</label>
                <textarea
                  value={consentAlternatives}
                  onChange={(e) => setConsentAlternatives(e.target.value)}
                  disabled={!canConsent || opConsentBrief?.status === "Given"}
                  rows={2}
                  placeholder="Conservative medical therapy, watchful waiting, alternative surgical procedures..."
                  className="w-full px-3 py-2 border rounded text-sm mt-1"
                  data-help="surgical_record_surgeon.consent_alternatives"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={consentReadAloud}
                onChange={(e) => setConsentReadAloud(e.target.checked)}
                disabled={!canConsent || opConsentBrief?.status === "Given"}
                className="rounded text-indigo-600"
                data-help="surgical_record_surgeon.consent_read_aloud"
              />
              <span className="text-xs text-gray-700">
                Consent details, risks, and alternatives were read aloud and explained to the patient in their vernacular.
              </span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleSaveConsent}
                disabled={!canConsent || submitting || opConsentBrief?.status === "Given"}
                className="px-5 py-2 bg-slate-800 text-white rounded text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
                data-help="surgical_record_surgeon.save_consent_btn"
              >
                {opConsentBrief ? "Update Consent Draft" : "Prepare Operation Consent"}
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowRefuseConsentModal(true)}
                  disabled={!opConsentBrief || opConsentBrief.status !== "Draft" || !canConsent}
                  className="px-4 py-2 border border-red-300 text-red-700 rounded text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                  data-help="surgical_record_surgeon.open_refuse_consent_btn"
                >
                  Record Refusal
                </button>

                <button
                  type="button"
                  onClick={() => setShowSignConsentModal(true)}
                  disabled={!opConsentBrief || opConsentBrief.status !== "Draft" || !canConsent}
                  className="px-5 py-2 bg-green-600 text-white rounded text-sm font-bold hover:bg-green-700 disabled:opacity-50"
                  data-help="surgical_record_surgeon.open_sign_consent_btn"
                >
                  Sign Consent (Given)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Operative Note & Post-Op Plan (Rule 2b25651d1e) */}
      {activeTab === "opnote" && (
        <div className="bg-white border rounded-lg p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b pb-2">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Operative Note & Post-Operative Plan</h2>
              <p className="text-xs text-gray-600">
                Surgical procedure details, wound classification, histopathology, and recovery orders (Rule 2b25651d1e, MSDS COP 50).
              </p>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                isOpNoteFinal ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
              }`}
            >
              Note: {opNote?.status || "Draft"}
            </span>
          </div>

          <div className="space-y-4">
            {/* Core Operative Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700">Actual Procedure Performed *</label>
                <input
                  type="text"
                  value={opProcPerformed}
                  onChange={(e) => setOpProcPerformed(e.target.value)}
                  disabled={isOpNoteFinal || !canOpNote}
                  className="w-full px-3 py-2 border rounded text-sm mt-1"
                  data-help="surgical_record_surgeon.op_proc_performed"
                />
                {formErrors.procedure_performed && (
                  <p className="text-xs text-red-600 mt-0.5">{formErrors.procedure_performed}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Post-Operative Diagnosis *</label>
                <input
                  type="text"
                  value={opPostOpDiag}
                  onChange={(e) => setOpPostOpDiag(e.target.value)}
                  disabled={isOpNoteFinal || !canOpNote}
                  className="w-full px-3 py-2 border rounded text-sm mt-1"
                  data-help="surgical_record_surgeon.op_postop_diag"
                />
                {formErrors.post_op_diagnosis && (
                  <p className="text-xs text-red-600 mt-0.5">{formErrors.post_op_diagnosis}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700">Incision Type & Location</label>
                <input
                  type="text"
                  value={opIncision}
                  onChange={(e) => setOpIncision(e.target.value)}
                  disabled={isOpNoteFinal || !canOpNote}
                  placeholder="e.g. McBurney, Right subcostal, Midline..."
                  className="w-full px-3 py-2 border rounded text-sm mt-1"
                  data-help="surgical_record_surgeon.op_incision"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Surgical Wound Classification * (MSDS COP 50)</label>
                <select
                  value={opWoundClass}
                  onChange={(e) => setOpWoundClass(e.target.value as any)}
                  disabled={isOpNoteFinal || !canOpNote}
                  className="w-full px-3 py-2 border rounded text-sm mt-1 bg-white"
                  data-help="surgical_record_surgeon.op_wound_class"
                >
                  {WOUND_CLASSES.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
                {formErrors.wound_class && (
                  <p className="text-xs text-red-600 mt-0.5">{formErrors.wound_class}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Patient Condition at End *</label>
                <select
                  value={opConditionEnd}
                  onChange={(e) => setOpConditionEnd(e.target.value as any)}
                  disabled={isOpNoteFinal || !canOpNote}
                  className="w-full px-3 py-2 border rounded text-sm mt-1 bg-white"
                  data-help="surgical_record_surgeon.op_condition_end"
                >
                  {CONDITIONS_AT_END.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700">Operative Surgical Findings *</label>
              <textarea
                value={opFindings}
                onChange={(e) => setOpFindings(e.target.value)}
                disabled={isOpNoteFinal || !canOpNote}
                rows={2}
                placeholder="Pathology encountered, anatomical variations, organ status, adhesions..."
                className="w-full px-3 py-2 border rounded text-sm mt-1"
                data-help="surgical_record_surgeon.op_findings"
              />
              {formErrors.findings && <p className="text-xs text-red-600 mt-0.5">{formErrors.findings}</p>}
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700">Operative Technique & Step-by-Step Details *</label>
              <textarea
                value={opTechnique}
                onChange={(e) => setOpTechnique(e.target.value)}
                disabled={isOpNoteFinal || !canOpNote}
                rows={3}
                placeholder="Dissection planes, vessels ligated, anastomoses, excision, haemostasis..."
                className="w-full px-3 py-2 border rounded text-sm mt-1"
                data-help="surgical_record_surgeon.op_technique"
              />
              {formErrors.procedure_details && (
                <p className="text-xs text-red-600 mt-0.5">{formErrors.procedure_details}</p>
              )}
            </div>

            {/* Implants, Specimens & Haemostasis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded border">
              <div>
                <label className="text-xs font-medium text-gray-700">Surgical Implants / Prosthetics</label>
                <input
                  type="text"
                  value={opImplants}
                  onChange={(e) => setOpImplants(e.target.value)}
                  disabled={isOpNoteFinal || !canOpNote}
                  placeholder="e.g. Prolene mesh 15x15cm, Plate, Screws..."
                  className="w-full px-3 py-1.5 border rounded text-sm mt-1"
                  data-help="surgical_record_surgeon.op_implants"
                />
                <label className="flex items-center gap-2 mt-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={opImplantLeft}
                    onChange={(e) => setOpImplantLeft(e.target.checked)}
                    disabled={isOpNoteFinal || !canOpNote}
                    className="rounded text-indigo-600"
                    data-help="surgical_record_surgeon.op_implant_left"
                  />
                  <span>Implant left in patient (activates 90-day SSI infection surveillance)</span>
                </label>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Tissue Specimens Sent for Histopathology</label>
                <input
                  type="text"
                  value={opSpecimens}
                  onChange={(e) => setOpSpecimens(e.target.value)}
                  disabled={isOpNoteFinal || !canOpNote}
                  placeholder="e.g. Gallbladder, Appendix, Margin biopsy..."
                  className="w-full px-3 py-1.5 border rounded text-sm mt-1"
                  data-help="surgical_record_surgeon.op_specimens"
                />
                <label className="flex items-center gap-2 mt-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={opHistopathology}
                    onChange={(e) => setOpHistopathology(e.target.checked)}
                    disabled={isOpNoteFinal || !canOpNote}
                    className="rounded text-indigo-600"
                    data-help="surgical_record_surgeon.op_histopathology"
                  />
                  <span>Formal pathology requisition dispatched with specimen</span>
                </label>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Surgical Drains & Tubes</label>
                <input
                  type="text"
                  value={opDrains}
                  onChange={(e) => setOpDrains(e.target.value)}
                  disabled={isOpNoteFinal || !canOpNote}
                  placeholder="e.g. Jackson-Pratt drain in pelvis, Corrugated drain..."
                  className="w-full px-3 py-1.5 border rounded text-sm mt-1"
                  data-help="surgical_record_surgeon.op_drains"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Closure Technique & Suture Material</label>
                <input
                  type="text"
                  value={opClosure}
                  onChange={(e) => setOpClosure(e.target.value)}
                  disabled={isOpNoteFinal || !canOpNote}
                  placeholder="e.g. Mass closure with Loop PDS, skin clips / Monocryl..."
                  className="w-full px-3 py-1.5 border rounded text-sm mt-1"
                  data-help="surgical_record_surgeon.op_closure"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Estimated Blood Loss (ml)</label>
                <input
                  type="number"
                  value={opBloodLoss}
                  onChange={(e) => setOpBloodLoss(e.target.value)}
                  disabled={isOpNoteFinal || !canOpNote}
                  placeholder="e.g. 150"
                  className="w-full px-3 py-1.5 border rounded text-sm mt-1"
                  data-help="surgical_record_surgeon.op_blood_loss"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Blood Products Administered</label>
                <input
                  type="text"
                  value={opTransfusion}
                  onChange={(e) => setOpTransfusion(e.target.value)}
                  disabled={isOpNoteFinal || !canOpNote}
                  placeholder="e.g. 1 unit PRBC, None..."
                  className="w-full px-3 py-1.5 border rounded text-sm mt-1"
                  data-help="surgical_record_surgeon.op_transfusion"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700">Unexpected Events / Complications</label>
              <textarea
                value={opUnexpected}
                onChange={(e) => setOpUnexpected(e.target.value)}
                disabled={isOpNoteFinal || !canOpNote}
                rows={2}
                placeholder="None or description of inadvertent enterotomy, massive haemorrhage..."
                className="w-full px-3 py-2 border rounded text-sm mt-1"
                data-help="surgical_record_surgeon.op_unexpected"
              />
            </div>

            {/* Post-Operative Orders (Rule 2b25651d1e) */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-4">
              <div className="border-b border-indigo-200 pb-2">
                <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider">
                  Post-Operative Care Plan & Instructions
                </h3>
                <p className="text-xs text-indigo-700">
                  Every section is required. Signing sets the inpatient ward's vitals monitoring interval automatically.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-gray-700">Monitoring Instructions *</label>
                    <button
                      type="button"
                      onClick={() => setOpMonitoring("Not needed")}
                      data-help="surgical_record_surgeon.op_monitoring"
                      className="text-[11px] text-indigo-600 hover:underline"
                    >
                      Not needed
                    </button>
                  </div>
                  <input
                    type="text"
                    value={opMonitoring}
                    onChange={(e) => setOpMonitoring(e.target.value)}
                    disabled={isOpNoteFinal || !canOpNote}
                    className="w-full px-3 py-1.5 border rounded text-sm mt-1"
                    data-help="surgical_record_surgeon.op_monitoring"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700">Vitals Monitoring Interval (Minutes) *</label>
                  <input
                    type="number"
                    value={opMonitoringInterval}
                    onChange={(e) => setOpMonitoringInterval(e.target.value)}
                    disabled={isOpNoteFinal || !canOpNote}
                    placeholder="e.g. 15, 30, 60, 120, 240..."
                    className="w-full px-3 py-1.5 border rounded text-sm mt-1"
                    data-help="surgical_record_surgeon.op_monitoring_interval"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-gray-700">Post-Op Medications & Analgesia *</label>
                    <button
                      type="button"
                      onClick={() => setOpMedications("Not needed")}
                      data-help="surgical_record_surgeon.op_medications"
                      className="text-[11px] text-indigo-600 hover:underline"
                    >
                      Not needed
                    </button>
                  </div>
                  <input
                    type="text"
                    value={opMedications}
                    onChange={(e) => setOpMedications(e.target.value)}
                    disabled={isOpNoteFinal || !canOpNote}
                    className="w-full px-3 py-1.5 border rounded text-sm mt-1"
                    data-help="surgical_record_surgeon.op_medications"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-gray-700">Wound Care & Dressing Instructions *</label>
                    <button
                      type="button"
                      onClick={() => setOpWoundCare("Not needed")}
                      data-help="surgical_record_surgeon.op_wound_care"
                      className="text-[11px] text-indigo-600 hover:underline"
                    >
                      Not needed
                    </button>
                  </div>
                  <input
                    type="text"
                    value={opWoundCare}
                    onChange={(e) => setOpWoundCare(e.target.value)}
                    disabled={isOpNoteFinal || !canOpNote}
                    className="w-full px-3 py-1.5 border rounded text-sm mt-1"
                    data-help="surgical_record_surgeon.op_wound_care"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-gray-700">Drains & Catheters Management *</label>
                    <button
                      type="button"
                      onClick={() => setOpDrainsCatheters("Not needed")}
                      data-help="surgical_record_surgeon.op_drains_catheters"
                      className="text-[11px] text-indigo-600 hover:underline"
                    >
                      Not needed
                    </button>
                  </div>
                  <input
                    type="text"
                    value={opDrainsCatheters}
                    onChange={(e) => setOpDrainsCatheters(e.target.value)}
                    disabled={isOpNoteFinal || !canOpNote}
                    className="w-full px-3 py-1.5 border rounded text-sm mt-1"
                    data-help="surgical_record_surgeon.op_drains_catheters"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-gray-700">Nutrition & Dietary Advancement *</label>
                    <button
                      type="button"
                      onClick={() => setOpNutrition("Not needed")}
                      data-help="surgical_record_surgeon.op_nutrition"
                      className="text-[11px] text-indigo-600 hover:underline"
                    >
                      Not needed
                    </button>
                  </div>
                  <input
                    type="text"
                    value={opNutrition}
                    onChange={(e) => setOpNutrition(e.target.value)}
                    disabled={isOpNoteFinal || !canOpNote}
                    className="w-full px-3 py-1.5 border rounded text-sm mt-1"
                    data-help="surgical_record_surgeon.op_nutrition"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-gray-700">Fluid Balance & Maintenance IV *</label>
                    <button
                      type="button"
                      onClick={() => setOpFluidBalance("Not needed")}
                      data-help="surgical_record_surgeon.op_fluid_balance"
                      className="text-[11px] text-indigo-600 hover:underline"
                    >
                      Not needed
                    </button>
                  </div>
                  <input
                    type="text"
                    value={opFluidBalance}
                    onChange={(e) => setOpFluidBalance(e.target.value)}
                    disabled={isOpNoteFinal || !canOpNote}
                    className="w-full px-3 py-1.5 border rounded text-sm mt-1"
                    data-help="surgical_record_surgeon.op_fluid_balance"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-gray-700">Specialty Referrals / Physiotherapy</label>
                    <button
                      type="button"
                      onClick={() => setOpReferrals("Not needed")}
                      data-help="surgical_record_surgeon.op_referrals"
                      className="text-[11px] text-indigo-600 hover:underline"
                    >
                      Not needed
                    </button>
                  </div>
                  <input
                    type="text"
                    value={opReferrals}
                    onChange={(e) => setOpReferrals(e.target.value)}
                    disabled={isOpNoteFinal || !canOpNote}
                    className="w-full px-3 py-1.5 border rounded text-sm mt-1"
                    data-help="surgical_record_surgeon.op_referrals"
                  />
                </div>
              </div>
            </div>

            {/* Actions: Save Draft vs Sign */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleSaveOperativeNote}
                disabled={isOpNoteFinal || !canOpNote || submitting}
                className="px-5 py-2 bg-slate-800 text-white rounded text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
                data-help="surgical_record_surgeon.save_opnote_btn"
              >
                Save Operative Note Draft
              </button>

              <button
                type="button"
                onClick={handleSignOperativeNote}
                disabled={isOpNoteFinal || !canOpNote || submitting}
                className="px-6 py-2 bg-green-600 text-white rounded text-sm font-bold hover:bg-green-700 disabled:opacity-50"
                data-help="surgical_record_surgeon.sign_opnote_btn"
              >
                {isOpNoteFinal ? "Operative Note Finalized (Signed)" : "Sign Operative Note"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Overview, Print & Audits */}
      {activeTab === "overview" && (
        <div className="bg-white border rounded-lg p-5 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b pb-2">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Surgical Record Overview & Audits</h2>
              <p className="text-xs text-gray-600">
                Complete audit trail of all chronological parts, print payloads, post-finality addenda, and in-theatre incidents.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrintRecord}
                className="px-4 py-2 bg-slate-800 text-white rounded text-sm font-medium hover:bg-slate-700"
                data-help="surgical_record_surgeon.print_record_btn"
              >
                Print Surgical Record (A4)
              </button>
            </div>
          </div>

          {/* Quick Audits Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setShowCorrectionModal(true)}
              disabled={!canCorrect}
              className="p-3 border border-amber-300 bg-amber-50 text-amber-800 rounded-lg text-left hover:bg-amber-100"
              data-help="surgical_record_surgeon.open_correction_btn"
            >
              <div className="font-bold text-sm">Add Correction Addendum</div>
              <div className="text-xs text-amber-700">Append a statutory retrospective correction to a signed record part.</div>
            </button>

            <button
              type="button"
              onClick={() => setShowIncidentModal(true)}
              disabled={!canReport}
              className="p-3 border border-red-300 bg-red-50 text-red-800 rounded-lg text-left hover:bg-red-100"
              data-help="surgical_record_surgeon.open_incident_btn"
            >
              <div className="font-bold text-sm">Report Adverse In-Theatre Incident</div>
              <div className="text-xs text-red-700">Document a complication or near miss to quality assurance.</div>
            </button>
          </div>

          {/* Corrections Ledger */}
          {surgicalRecord?.corrections && surgicalRecord.corrections.length > 0 && (
            <div className="bg-slate-50 border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Statutory Corrections Ledger</h3>
              <div className="space-y-2">
                {surgicalRecord.corrections.map((c) => (
                  <div key={c.correction_id} className="p-2.5 bg-white rounded border text-xs">
                    <div className="flex justify-between items-center font-bold text-gray-900">
                      <span>Part: {c.record}</span>
                      <span className="text-gray-500 font-normal">{new Date(c.created_at).toLocaleString()}</span>
                    </div>
                    <div className="mt-1 text-gray-800">{c.correction_text}</div>
                    <div className="mt-1 text-gray-500">
                      <span className="font-semibold">Reason:</span> {c.correction_reason} | By {c.author_stamp?.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Adverse Incidents Ledger */}
          {surgicalRecord?.adverse_events && surgicalRecord.adverse_events.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-bold text-red-900 uppercase tracking-wider">Reported In-Theatre Adverse Incidents</h3>
              <div className="space-y-2">
                {surgicalRecord.adverse_events.map((ev) => (
                  <div key={ev.incident_id} className="p-2.5 bg-white rounded border border-red-200 text-xs">
                    <div className="flex justify-between font-bold text-red-900">
                      <span>{ev.type_name}</span>
                      <span className="text-gray-500 font-normal">{new Date(ev.occurred_at).toLocaleString()}</span>
                    </div>
                    <div className="mt-1 text-gray-800">Area: {ev.area} | Severity: {ev.harm} | Status: {ev.status}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Sign Operation Consent */}
      {showSignConsentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-green-700">Record Operation Consent as Given</h2>
            <p className="text-xs text-gray-600">
              Verify decision maker legal relationship, vernacular understanding, and staff witness.
            </p>

            <form onSubmit={handleSignConsentSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700">Decision Maker Relationship *</label>
                <select
                  value={signDecisionMakerRel}
                  onChange={(e) => setSignDecisionMakerRel(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded text-sm mt-1 bg-white"
                  data-help="surgical_record_surgeon.sign_decision_maker_rel"
                >
                  <option value="Self">Self (Patient)</option>
                  {decisionMakers.map((d) => (
                    <option key={d.relationship} value={d.relationship}>
                      {d.relationship} ({d.description})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Signer Full Name *</label>
                <input
                  type="text"
                  value={signSignerName}
                  onChange={(e) => setSignSignerName(e.target.value)}
                  placeholder="Patient or decision maker legal name"
                  className="w-full px-3 py-1.5 border rounded text-sm mt-1"
                  data-help="surgical_record_surgeon.sign_signer_name"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Signer CNIC / Identity Number</label>
                <input
                  type="text"
                  value={signSignerCnic}
                  onChange={(e) => setSignSignerCnic(e.target.value)}
                  placeholder="XXXXX-XXXXXXX-X"
                  className="w-full px-3 py-1.5 border rounded text-sm mt-1"
                  data-help="surgical_record_surgeon.sign_signer_cnic"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Signing Method</label>
                <select
                  value={signMethod}
                  onChange={(e) => setSignMethod(e.target.value as any)}
                  className="w-full px-3 py-1.5 border rounded text-sm mt-1 bg-white"
                  data-help="surgical_record_surgeon.sign_method"
                >
                  <option value="Signature">Digital Signature</option>
                  <option value="ThumbImpression">Thumb Impression (Witness Mandatory)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-700">Staff Witness Name</label>
                  <input
                    type="text"
                    value={signWitnessName}
                    onChange={(e) => setSignWitnessName(e.target.value)}
                    placeholder="Witness staff name"
                    className="w-full px-3 py-1.5 border rounded text-sm mt-1"
                    data-help="surgical_record_surgeon.sign_witness_name"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">Witness CNIC</label>
                  <input
                    type="text"
                    value={signWitnessCnic}
                    onChange={(e) => setSignWitnessCnic(e.target.value)}
                    placeholder="Witness CNIC"
                    className="w-full px-3 py-1.5 border rounded text-sm mt-1"
                    data-help="surgical_record_surgeon.sign_witness_cnic"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSignConsentModal(false)}
                  className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-100"
                  data-help="surgical_record_surgeon.sign_cancel_btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-green-600 text-white rounded text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
                  data-help="surgical_record_surgeon.sign_submit_btn"
                >
                  Confirm & Give Consent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Refuse Operation Consent */}
      {showRefuseConsentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-red-700">Record Informed Surgical Refusal</h2>
            <p className="text-xs text-gray-600">
              Document patient or decision maker refusal in their own words after full risk disclosure.
            </p>

            <form onSubmit={handleRefuseConsentSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700">Refusal Reason (Patient's Words) *</label>
                <textarea
                  value={refuseReason}
                  onChange={(e) => setRefuseReason(e.target.value)}
                  rows={3}
                  placeholder="State clinical reason for refusal and consequences explained..."
                  className="w-full px-3 py-2 border rounded text-sm mt-1"
                  data-help="surgical_record_surgeon.refuse_reason"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Staff Witness Name</label>
                <input
                  type="text"
                  value={refuseWitness}
                  onChange={(e) => setRefuseWitness(e.target.value)}
                  placeholder="Staff member witnessing verbal refusal"
                  className="w-full px-3 py-2 border rounded text-sm mt-1"
                  data-help="surgical_record_surgeon.refuse_witness"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRefuseConsentModal(false)}
                  className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-100"
                  data-help="surgical_record_surgeon.refuse_cancel_btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-red-600 text-white rounded text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                  data-help="surgical_record_surgeon.refuse_submit_btn"
                >
                  Record Formal Refusal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Post-Finality Correction Addendum */}
      {showCorrectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Append Correction Addendum</h2>
            <p className="text-xs text-gray-600">
              Signed surgical parts are legally final (OT_RECORD_FINAL). Retrospective modifications require mandatory audit reasons.
            </p>

            <form onSubmit={handleAddCorrection} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700">Record Part *</label>
                <select
                  value={corrRecordPart}
                  onChange={(e) => setCorrRecordPart(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded text-sm mt-1 bg-white"
                  data-help="surgical_record_surgeon.corr_record_part"
                >
                  <option value="PreOpNote">PreOpNote</option>
                  <option value="OperativeNote">OperativeNote</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Correction Text *</label>
                <textarea
                  value={corrText}
                  onChange={(e) => setCorrText(e.target.value)}
                  rows={3}
                  placeholder="Clinical facts or additions to append..."
                  className="w-full px-3 py-2 border rounded text-sm mt-1"
                  data-help="surgical_record_surgeon.corr_text"
                />
                {formErrors.correction_text && (
                  <p className="text-xs text-red-600 mt-0.5">{formErrors.correction_text}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Audit Reason *</label>
                <input
                  type="text"
                  value={corrReason}
                  onChange={(e) => setCorrReason(e.target.value)}
                  placeholder="Justification for retrospective addendum..."
                  className="w-full px-3 py-2 border rounded text-sm mt-1"
                  data-help="surgical_record_surgeon.corr_reason"
                />
                {formErrors.correction_reason && (
                  <p className="text-xs text-red-600 mt-0.5">{formErrors.correction_reason}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-100"
                  data-help="surgical_record_surgeon.corr_cancel_btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-600 text-white rounded text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
                  data-help="surgical_record_surgeon.corr_submit_btn"
                >
                  Submit Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Adverse Incident Reporting */}
      {showIncidentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-red-700">Report In-Theatre Adverse Incident</h2>
            <p className="text-xs text-gray-600">
              Document adverse events, complications, or near-misses to hospital quality assurance (area: Surgery).
            </p>

            <form onSubmit={handleSubmitIncident} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700">Incident Category *</label>
                <select
                  value={selectedIncidentTypeCode}
                  onChange={(e) => setSelectedIncidentTypeCode(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm mt-1 bg-white"
                  data-help="surgical_record_surgeon.incident_type"
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
                  placeholder="Detailed clinical account, unexpected finding, corrective action..."
                  className="w-full px-3 py-2 border rounded text-sm mt-1"
                  data-help="surgical_record_surgeon.incident_summary"
                />
                {formErrors.description && (
                  <p className="text-xs text-red-600 mt-0.5">{formErrors.description}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowIncidentModal(false)}
                  className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-100"
                  data-help="surgical_record_surgeon.incident_cancel_btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-red-600 text-white rounded text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                  data-help="surgical_record_surgeon.incident_submit_btn"
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
