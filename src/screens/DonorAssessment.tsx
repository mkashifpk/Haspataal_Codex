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
  DonorOut,
  DonorDetailOut,
  DonationIn,
  DonationOut,
  DonationDetailOut,
  DonorDeferralIn,
  DonorDeferralOut,
  DonorTellIn,
  DeferralRevokeIn,
} from "../generated/donor_assessment";
import {
  listDonors,
  getDonor,
  listDonations,
  getDonation,
} from "../generated/donor_assessment";
import {
  getDonorAssessmentView,
  canStartNewAssessment,
  isDoctorAuthorizedForAssessment,
  evaluateDonorEligibility,
  validateDonationAssessment,
  validateDeferralInput,
  validateDonorTellInput,
  validateRevokeDeferral,
  PBTA_TEMPORARY_DEFERRAL_GUIDANCE,
  PBTA_PERMANENT_DEFERRAL_GUIDANCE,
} from "../donor-assessment-policy";
import { useClinicalWrite, ClinicalWriteFeedback } from "../clinical-write";

export function DonorAssessment({
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
  const view = getDonorAssessmentView(establishment);
  const isDoctor = isDoctorAuthorizedForAssessment(user);
  const isBloodCenterActive = establishment.active?.includes("blood_center") ?? false;
  const canAssessNew = canStartNewAssessment(establishment, isDoctor && (user.permissions?.includes("blood_center.donor.assess") ?? false));
  const canRead = user.permissions?.includes("blood_center.view") ?? false;
  const canWrite = user.permissions?.includes("blood_center.donor.assess") ?? false;

  const [activeTab, setActiveTab] = useState<"assess" | "reactive" | "donors">("assess");
  const [revision, setRevision] = useState(0);
  const [realtimeAlert, setRealtimeAlert] = useState<string | null>(null);

  // Search donor state (rule:71bc3f69b3)
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<DonorOut[]>([]);
  const [selectedDonor, setSelectedDonor] = useState<DonorDetailOut | null>(null);
  const [loadingDonor, setLoadingDonor] = useState(false);

  // Assessment form state
  const [donationKind, setDonationKind] = useState<"Voluntary" | "Replacement" | "Autologous">("Voluntary");
  const [forPatientId, setForPatientId] = useState<string>("");
  const [venue, setVenue] = useState<"BloodCenter" | "Camp">("BloodCenter");
  const [venueNote, setVenueNote] = useState<string>("");
  const [historyCompleted, setHistoryCompleted] = useState<boolean>(false);
  const [historyNote, setHistoryNote] = useState<string>("");
  const [weightKg, setWeightKg] = useState<string>("65.0");
  const [hbGDl, setHbGDl] = useState<string>("13.5");
  const [hbMethod, setHbMethod] = useState<"Photometer" | "CopperSulphate" | "Haematocrit" | "Analyser">("Photometer");
  const [pulse, setPulse] = useState<string>("76");
  const [bpSystolic, setBpSystolic] = useState<string>("120");
  const [bpDiastolic, setBpDiastolic] = useState<string>("80");
  const [temperatureC, setTemperatureC] = useState<string>("36.8");
  const [outcome, setOutcome] = useState<"Accepted" | "Deferred">("Accepted");

  // Consent & Unpaid declaration (rule:91e1708abe: separate boxes, never pre-ticked)
  const [consentSigned, setConsentSigned] = useState<boolean>(false);
  const [consentLanguage, setConsentLanguage] = useState<string>("Urdu");
  const [unpaidDeclared, setUnpaidDeclared] = useState<boolean>(false);

  // Deferral fields within assessment form (rule:a8bf19300f)
  const [formDeferralKind, setFormDeferralKind] = useState<"Temporary" | "Permanent">("Temporary");
  const [formDeferredUntil, setFormDeferredUntil] = useState<string>("");
  const [formDeferralReason, setFormDeferralReason] = useState<string>("");
  const [formToldNow, setFormToldNow] = useState<boolean>(true);
  const [formCommunication, setFormCommunication] = useState<"InPerson" | "Phone" | "Letter">("InPerson");
  const [formCounselled, setFormCounselled] = useState<boolean>(true);
  const [formReferredTo, setFormReferredTo] = useState<string>("");

  // Modals state
  const [standaloneDeferralOpen, setStandaloneDeferralOpen] = useState(false);
  const [standaloneDeferralDonor, setStandaloneDeferralDonor] = useState<DonorDetailOut | null>(null);
  const [standaloneKind, setStandaloneKind] = useState<"Temporary" | "Permanent">("Temporary");
  const [standaloneUntil, setStandaloneUntil] = useState<string>("");
  const [standaloneReason, setStandaloneReason] = useState<string>("");
  const [standaloneDonationId, setStandaloneDonationId] = useState<number | null>(null);
  const [standaloneTold, setStandaloneTold] = useState<boolean>(true);
  const [standaloneCommunication, setStandaloneCommunication] = useState<"InPerson" | "Phone" | "Letter">("InPerson");
  const [standaloneCounselled, setStandaloneCounselled] = useState<boolean>(true);
  const [standaloneReferredTo, setStandaloneReferredTo] = useState<string>("");

  const [informModalOpen, setInformModalOpen] = useState(false);
  const [informDeferralId, setInformDeferralId] = useState<number | null>(null);
  const [informCommunication, setInformCommunication] = useState<"InPerson" | "Phone" | "Letter">("InPerson");
  const [informTime, setInformTime] = useState<string>(new Date().toISOString().slice(0, 16));
  const [informCounselled, setInformCounselled] = useState<boolean>(true);
  const [informReferredTo, setInformReferredTo] = useState<string>("");

  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [revokeDeferralTarget, setRevokeDeferralTarget] = useState<DonorDeferralOut | null>(null);
  const [revokeReason, setRevokeReason] = useState<string>("");

  const [inspectedDonation, setInspectedDonation] = useState<DonationDetailOut | null>(null);
  const [loadingInspection, setLoadingInspection] = useState(false);
  const [fullDonorModalOpen, setFullDonorModalOpen] = useState(false);

  // Filters for donation list
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>("All");
  const [historyDateFrom, setHistoryDateFrom] = useState<string>("");
  const [historyDateTo, setHistoryDateTo] = useState<string>("");

  // Clinical Write with safe recovery (rule:eef3feb4b9)
  const write = useClinicalWrite(user, "donor_assessment", (value, cmd) => {
    setRevision((r) => r + 1);
    if (cmd.path === "/blood-center/donations") {
      if (selectedDonor) selectDonorById(selectedDonor.donor_id);
      alert(
        outcome === "Accepted"
          ? t(
              `Donor accepted for collection. Donation #${value?.donation_number || ""} created.`,
              `عطیہ دہندہ قبول کر لیا گیا۔ عطیہ نمبر #${value?.donation_number || ""} درج ہوا۔`,
            )
          : t(
              `Donor deferred (${formDeferralKind}). Deferral recorded on donor lifetime file.`,
              `عطیہ دہندہ کا التواء (${formDeferralKind}) فائل پر درج کر دیا گیا۔`,
            ),
      );
    } else if (cmd.path.includes("/deferrals") && !cmd.path.includes("/inform") && !cmd.path.includes("/revoke")) {
      setStandaloneDeferralOpen(false);
      if (selectedDonor) selectDonorById(selectedDonor.donor_id);
      alert(t("Deferral recorded successfully.", "التواء کا فیصلہ کامیابی سے درج ہو گیا۔"));
    } else if (cmd.path.includes("/inform")) {
      setInformModalOpen(false);
      if (selectedDonor) selectDonorById(selectedDonor.donor_id);
      alert(t("Communication to donor recorded.", "عطیہ دہندہ کو باخبر کرنے کی تفصیلات درج ہو گئیں۔"));
    } else if (cmd.path.includes("/revoke")) {
      setRevokeModalOpen(false);
      if (selectedDonor) selectDonorById(selectedDonor.donor_id);
      if (inspectedDonation) openDonationInspection(inspectedDonation.donation_id);
      alert(t("Deferral revoked on record.", "غلط اندراج پر التواء کامیابی سے منسوخ کر دیا گیا۔"));
    }
  });

  // Load Reactive Worklist (rule:d8cd988a65)
  const reactiveWorklist = useLoad(
    () => (canRead ? listDonations({ status: "Reactive" }) : Promise.resolve([])),
    [revision, canRead],
  );

  // Load Donation History tab
  const donationsHistory = useLoad(
    () =>
      canRead
        ? listDonations({
            status: historyStatusFilter === "All" ? undefined : (historyStatusFilter as any),
            date_from: historyDateFrom || undefined,
            date_to: historyDateTo || undefined,
          })
        : Promise.resolve([]),
    [revision, historyStatusFilter, historyDateFrom, historyDateTo, canRead],
  );

  // Real-time Event Subscription (blood_center.donation.reactive and establishment.changed)
  useEffect(() => {
    const handleEvent = (event: Event) => {
      const custom = event as CustomEvent;
      const data = custom.detail;
      if (!data) return;
      const evType = data.event_type || data.type;

      if (evType === "blood_center.donation.reactive") {
        setRealtimeAlert(
          t(
            "Reactive Screening Alert: A blood donation screening tested reactive. Added to Reactive Worklist.",
            "رد عمل کا انتباہ: اسکریننگ ٹیسٹ میں خون کا عطیہ ری ایکٹیو پایا گیا۔ رد عمل کی فہرست تازہ ہو گئی۔",
          ),
        );
        setRevision((r) => r + 1);
      } else if (evType === "establishment.changed") {
        setRevision((r) => r + 1);
      }
    };

    window.addEventListener("haspataal:event", handleEvent);
    return () => window.removeEventListener("haspataal:event", handleEvent);
  }, []);

  // Donor Search handler (rule:71bc3f69b3)
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchError(
        t(
          "Search query requires at least 2 characters (donor number, CNIC, phone, or name).",
          "تلاش کے لیے کم از کم 2 حروف درج کریں (ڈونر نمبر، شناختی کارڈ، فون، یا نام)۔",
        ),
      );
      return;
    }
    setSearchError(null);
    setIsSearching(true);
    try {
      const results = await listDonors({ q: query });
      setSearchResults(results);
      if (results.length === 1) {
        await selectDonorById(results[0].donor_id);
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSearching(false);
    }
  };

  const selectDonorById = async (donorId: number) => {
    setLoadingDonor(true);
    try {
      const full = await getDonor(donorId);
      setSelectedDonor(full);
      // Reset assessment form
      setConsentSigned(false);
      setUnpaidDeclared(false);
      setHistoryCompleted(false);
      setOutcome("Accepted");
      // Set reasonable Hb default based on sex
      setHbGDl(full.sex === "Female" ? "12.8" : "14.2");
      // Default deferral until 30 days from now
      const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      setFormDeferredUntil(thirtyDays);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingDonor(false);
    }
  };

  // Inspect donation details modal
  const openDonationInspection = async (donationId: number) => {
    setLoadingInspection(true);
    try {
      const detail = await getDonation(donationId);
      setInspectedDonation(detail);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingInspection(false);
    }
  };

  // Pre-evaluate eligibility for active donor
  const eligibility = selectedDonor
    ? evaluateDonorEligibility(
        selectedDonor,
        {
          weight_kg: weightKg,
          hb_g_dl: hbGDl,
          pulse: pulse ? Number(pulse) : null,
          bp_systolic: bpSystolic ? Number(bpSystolic) : null,
          bp_diastolic: bpDiastolic ? Number(bpDiastolic) : null,
          temperature_c: temperatureC ? Number(temperatureC) : null,
        },
        selectedDonor.donations_collected === 0,
      )
    : null;

  // Handle assessment submit (rule:91e1708abe, rule:eee718a5dc, rule:a8bf19300f, rule:eef3feb4b9)
  const handleSubmitAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDonor) return;

    const payload: DonationIn = {
      donor_id: selectedDonor.donor_id,
      donation_kind: donationKind,
      for_patient_id: forPatientId ? Number(forPatientId) : null,
      venue,
      venue_note: venue === "Camp" ? venueNote : null,
      history_completed: historyCompleted,
      history_note: historyNote || null,
      weight_kg: Number(weightKg),
      hb_g_dl: Number(hbGDl),
      hb_method: hbMethod,
      pulse: pulse ? Number(pulse) : null,
      bp_systolic: bpSystolic ? Number(bpSystolic) : null,
      bp_diastolic: bpDiastolic ? Number(bpDiastolic) : null,
      temperature_c: temperatureC ? Number(temperatureC) : null,
      outcome,
    };

    if (outcome === "Accepted") {
      payload.consent_signed = consentSigned;
      payload.consent_language = consentLanguage;
      payload.unpaid_declared = unpaidDeclared;
    } else {
      payload.deferral = {
        kind: formDeferralKind,
        reason: formDeferralReason,
        deferred_until: formDeferralKind === "Temporary" ? formDeferredUntil : null,
        told: formToldNow
          ? {
              communicated_at: new Date().toISOString(),
              communication: formCommunication,
              counselled: formCounselled,
              referred_to: formReferredTo || null,
            }
          : null,
      };
    }

    const validation = validateDonationAssessment(payload, selectedDonor);
    if (!validation.valid) {
      const msgs = Object.values(validation.errors).join("\n• ");
      alert(`Validation error:\n• ${msgs}`);
      return;
    }

    write.start({
      method: "POST",
      path: "/blood-center/donations",
      body: payload,
      permission: "blood_center.donor.assess",
      protection: "idempotent",
      label: outcome === "Accepted" ? "Accept donor for donation" : "Record donor deferral",
    });
  };

  // Submit standalone deferral modal
  const handleStandaloneDeferralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!standaloneDeferralDonor) return;

    const defIn: DonorDeferralIn = {
      kind: standaloneKind,
      reason: standaloneReason,
      deferred_until: standaloneKind === "Temporary" ? standaloneUntil : null,
      donation_id: standaloneDonationId || undefined,
      told: standaloneTold
        ? {
            communicated_at: new Date().toISOString(),
            communication: standaloneCommunication,
            counselled: standaloneCounselled,
            referred_to: standaloneReferredTo || null,
          }
        : null,
    };

    const val = validateDeferralInput(defIn);
    if (!val.valid) {
      alert(Object.values(val.errors).join("\n"));
      return;
    }

    write.start({
      method: "POST",
      path: `/blood-center/donors/${standaloneDeferralDonor.donor_id}/deferrals`,
      body: defIn,
      permission: "blood_center.donor.assess",
      protection: "idempotent",
      label: "Record donor deferral",
    });
  };

  // Submit Inform modal (POST /blood-center/deferrals/{id}/inform)
  const handleInformSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!informDeferralId) return;

    const tellIn: DonorTellIn = {
      communicated_at: new Date(informTime).toISOString(),
      communication: informCommunication,
      counselled: informCounselled,
      referred_to: informReferredTo || null,
    };

    const val = validateDonorTellInput(tellIn);
    if (!val.valid) {
      alert(Object.values(val.errors).join("\n"));
      return;
    }

    write.start({
      method: "POST",
      path: `/blood-center/deferrals/${informDeferralId}/inform`,
      body: tellIn,
      permission: "blood_center.donor.assess",
      protection: "reconcile",
      label: "Record confidential donor disclosure",
    });
  };

  // Submit Revoke modal (POST /blood-center/deferrals/{id}/revoke) (rule:d8cd988a65)
  const handleRevokeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokeDeferralTarget) return;

    const val = validateRevokeDeferral(revokeReason);
    if (!val.valid) {
      alert(val.error);
      return;
    }

    const revokeIn: DeferralRevokeIn = {
      reason: revokeReason.trim(),
    };

    write.start({
      method: "POST",
      path: `/blood-center/deferrals/${revokeDeferralTarget.deferral_id}/revoke`,
      body: revokeIn,
      permission: "blood_center.donor.assess",
      protection: "reconcile",
      label: "Revoke donor deferral",
    });
  };

  return (
    <div className="donor-assessment-screen" style={{ padding: "1rem", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Title & Regulatory Header */}
      <header style={{ marginBottom: "1.25rem", borderBottom: "2px solid #e2e8f0", paddingBottom: "0.75rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h1 style={{ margin: "0 0 0.25rem 0", fontSize: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>🩸</span>
              <span>{t("Donor Medical Assessment & Deferrals", "عطیہ دہندہ کا طبی معائنہ و التواء")}</span>
            </h1>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>
              {t(
                "Punjab Blood Transfusion Authority (PBTA) Standards · Punjab Blood Transfusion Safety Act 2016 s.10",
                "پنجاب بلڈ ٹرانسفیوژن اتھارٹی معیار اور ایکٹ 2016 کے تحت ڈونر اسکریننگ اور التواء",
              )}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button
              type="button"
              data-help="donor_assessment.refresh"
              onClick={() => setRevision((r) => r + 1)}
              style={{ padding: "0.4rem 0.75rem", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#f8fafc" }}
            >
              🔄 {t("Refresh", "تازہ کریں")}
            </button>
          </div>
        </div>

        {/* Retiring Banner (rule:1af6af6a9c) */}
        {view === "open_work" && (
          <div
            role="status"
            style={{
              marginTop: "0.75rem",
              padding: "0.75rem 1rem",
              background: "#fffbeb",
              border: "1px solid #fde68a",
              color: "#92400e",
              borderRadius: "6px",
              fontWeight: 500,
            }}
          >
            ⚠️ {t(
              "No new donor assessments from now on (Blood Center service is Retiring) — completing open reviews and deferrals only.",
              "اب سے کوئی نیا ڈونر معائنہ شروع نہیں ہوگا (بلڈ سنٹر سروس ریٹائر ہو رہی ہے) — صرف التواء اور معائنے کا ریکارڈ دیکھا جا سکتا ہے۔",
            )}
          </div>
        )}

        {/* Records Only Banner */}
        {view === "records" && (
          <div
            role="status"
            style={{
              marginTop: "0.75rem",
              padding: "0.75rem 1rem",
              background: "#f1f5f9",
              border: "1px solid #cbd5e1",
              color: "#475569",
              borderRadius: "6px",
            }}
          >
            📋 {t("Records Mode (Service Retired) — Read-only access to donor history and previous deferrals.", "صرف ریکارڈز موڈ — تاریخی ڈونرز اور التواء کا مطالعہ۔")}
          </div>
        )}

        {/* PMDC Doctor Registration Banner (rule:2f34c9a08a) */}
        {!isDoctor && (
          <div
            role="alert"
            style={{
              marginTop: "0.75rem",
              padding: "0.75rem 1rem",
              background: "#fee2e2",
              border: "1px solid #fca5a5",
              color: "#991b1b",
              borderRadius: "6px",
              fontSize: "0.875rem",
            }}
          >
            ⛔ {t(
              "Only a medical doctor with PMDC/PMC registration on their staff record is authorized to perform donor assessment, record deferrals, or inform donors (BLOOD_DONOR_DOCTOR_REQUIRED).",
              "صرف پی ایم ڈی سی سے رجسٹرڈ ڈاکٹر ہی ڈونر کا معائنہ، التواء، اور رازداری سے آگاہ کرنے کے مجاز ہیں (قاعدہ 2f34c9a08a)۔",
            )}
          </div>
        )}

        {/* Capability inactive alert (rule:21d2bc008e) */}
        {!isBloodCenterActive && (
          <div
            role="alert"
            style={{
              marginTop: "0.75rem",
              padding: "0.75rem 1rem",
              background: "#fef3c7",
              border: "1px solid #fcd34d",
              color: "#92400e",
              borderRadius: "6px",
              fontSize: "0.875rem",
            }}
          >
            ⚠️ {t("Blood Center capability is currently inactive in facility profile. New assessments are disabled.", "بلڈ سنٹر کی سہولت فعال نہیں ہے۔ نیا معائنہ معطل ہے۔")}
          </div>
        )}

        {/* Real-time Reactive Notice */}
        {realtimeAlert && (
          <div
            role="status"
            style={{
              marginTop: "0.75rem",
              padding: "0.75rem 1rem",
              background: "#fef2f2",
              border: "1px solid #f87171",
              color: "#b91c1c",
              borderRadius: "6px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>🔔 {realtimeAlert}</span>
            <button
              type="button"
              data-help="donor_assessment.dismiss_alert"
              onClick={() => setRealtimeAlert(null)}
              style={{ background: "none", border: "none", color: "#b91c1c", cursor: "pointer", fontWeight: "bold" }}
            >
              ✕
            </button>
          </div>
        )}
      </header>

      {/* Tabs navigation */}
      <nav style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", borderBottom: "1px solid #e2e8f0" }}>
        <button
          type="button"
          data-help="donor_assessment.tab_assess"
          onClick={() => setActiveTab("assess")}
          style={{
            padding: "0.6rem 1.25rem",
            border: "none",
            borderBottom: activeTab === "assess" ? "3px solid #dc2626" : "3px solid transparent",
            background: "none",
            fontWeight: activeTab === "assess" ? "bold" : "normal",
            color: activeTab === "assess" ? "#dc2626" : "#475569",
            cursor: "pointer",
          }}
        >
          🩺 {t("Assess Donor", "ڈونر کا معائنہ")}
        </button>
        <button
          type="button"
          data-help="donor_assessment.tab_reactive"
          onClick={() => setActiveTab("reactive")}
          style={{
            padding: "0.6rem 1.25rem",
            border: "none",
            borderBottom: activeTab === "reactive" ? "3px solid #dc2626" : "3px solid transparent",
            background: "none",
            fontWeight: activeTab === "reactive" ? "bold" : "normal",
            color: activeTab === "reactive" ? "#dc2626" : "#475569",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <span>⚠️ {t("Reactive Worklist", "رد عمل کی فہرست")}</span>
          {reactiveWorklist.data && reactiveWorklist.data.length > 0 && (
            <span
              style={{
                background: "#dc2626",
                color: "#fff",
                borderRadius: "10px",
                padding: "0.1rem 0.45rem",
                fontSize: "0.75rem",
                fontWeight: "bold",
              }}
            >
              {reactiveWorklist.data.length}
            </span>
          )}
        </button>
        <button
          type="button"
          data-help="donor_assessment.tab_donors"
          onClick={() => setActiveTab("donors")}
          style={{
            padding: "0.6rem 1.25rem",
            border: "none",
            borderBottom: activeTab === "donors" ? "3px solid #dc2626" : "3px solid transparent",
            background: "none",
            fontWeight: activeTab === "donors" ? "bold" : "normal",
            color: activeTab === "donors" ? "#dc2626" : "#475569",
            cursor: "pointer",
          }}
        >
          📋 {t("Donation History & Audit", "عطیات کا ریکارڈ اور جائزہ")}
        </button>
      </nav>

      {/* Clinical Write Feedback */}
      <ClinicalWriteFeedback write={write} />

      {/* TAB 1: ASSESS DONOR */}
      {activeTab === "assess" && (
        <div className="donor-assessment-layout" style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "1.25rem" }}>
          {/* Left Column: Search & Donor Profile */}
          <div>
            {/* Search Card */}
            <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "1rem", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1rem", margin: "0 0 0.5rem 0", color: "#1e293b" }}>
                🔍 {t("Search Donor", "عطیہ دہندہ تلاش کریں")}
              </h2>
              <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.75rem", color: "#64748b" }}>
                {t(
                  "PBTA Act s.10 Audit Notice: Every record lookup is logged under your staff ID.",
                  "پی بی ٹی اے ایکٹ کے تحت ہر تلاش اور فائل کھولنے کا اندراج آپ کی شناخت سے ہوتا ہے۔",
                )}
              </p>
              <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <input
                  type="text"
                  data-help="donor_assessment.search_input"
                  placeholder={t("Donor #, CNIC, Phone, Name...", "ڈونر نمبر، شناختی کارڈ، فون، نام...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ flex: 1, padding: "0.45rem 0.6rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                />
                <button
                  type="submit"
                  data-help="donor_assessment.search_button"
                  disabled={isSearching}
                  style={{
                    padding: "0.45rem 0.85rem",
                    background: "#2563eb",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  {isSearching ? t("Searching...", "تلاش جاری...") : t("Find", "تلاش")}
                </button>
                {searchQuery && (
                  <button
                    type="button"
                    data-help="donor_assessment.search_clear"
                    onClick={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    style={{ padding: "0.45rem 0.6rem", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                  >
                    ✕
                  </button>
                )}
              </form>

              {searchError && (
                <div role="alert" style={{ color: "#dc2626", fontSize: "0.8rem", marginBottom: "0.5rem" }}>
                  {searchError}
                </div>
              )}

              {/* Search Results List */}
              {searchResults.length > 0 && (
                <div style={{ maxHeight: "220px", overflowY: "auto", borderTop: "1px solid #e2e8f0", paddingTop: "0.5rem" }}>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>
                    {t(`Found ${searchResults.length} donor(s):`, `${searchResults.length} ڈونر ملے:`)}
                  </div>
                  {searchResults.map((d) => (
                    <button
                      key={d.donor_id}
                      type="button"
                      data-help="donor_assessment.select_donor"
                      onClick={() => selectDonorById(d.donor_id)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "0.5rem",
                        marginBottom: "0.25rem",
                        borderRadius: "4px",
                        border: selectedDonor?.donor_id === d.donor_id ? "2px solid #2563eb" : "1px solid #e2e8f0",
                        background: selectedDonor?.donor_id === d.donor_id ? "#eff6ff" : "#ffffff",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: "bold", fontSize: "0.85rem" }}>{d.full_name}</div>
                      <div style={{ fontSize: "0.75rem", color: "#475569", display: "flex", justifyContent: "space-between" }}>
                        <span>{d.donor_number} · {d.sex} ({d.age_years}y)</span>
                        {d.abo && <span>{d.abo} {d.rh}</span>}
                      </div>
                      <div style={{ fontSize: "0.7rem", marginTop: "0.2rem" }}>
                        {d.permanently_deferred ? (
                          <span style={{ color: "#dc2626", fontWeight: "bold" }}>● {t("Permanently Deferred", "مستقل مسترد")}</span>
                        ) : d.deferred_now ? (
                          <span style={{ color: "#d97706", fontWeight: "bold" }}>● {t("Deferred Today", "عارضی التواء")}</span>
                        ) : (
                          <span style={{ color: "#16a34a" }}>● {t("Eligible to assess", "اہل")}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Donor Detail Card */}
            {loadingDonor && <LoadState loading={true} error={null} retry={() => {}} />}
            {selectedDonor && !loadingDonor && (
              <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                  <div>
                    <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.2rem 0", color: "#0f172a" }}>
                      {selectedDonor.full_name}
                    </h2>
                    <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: "bold" }}>
                      {selectedDonor.donor_number}
                    </span>
                  </div>
                  {selectedDonor.abo && (
                    <div style={{ background: "#fee2e2", color: "#991b1b", padding: "0.25rem 0.5rem", borderRadius: "4px", fontWeight: "bold", fontSize: "0.85rem" }}>
                      {selectedDonor.abo} {selectedDonor.rh}
                    </div>
                  )}
                </div>

                <div style={{ fontSize: "0.8rem", color: "#334155", lineHeight: "1.5", marginBottom: "0.75rem" }}>
                  <div><strong>{t("Sex / Age:", "جنس / عمر:")}</strong> {selectedDonor.sex} · {selectedDonor.age_years} {t("years", "سال")}</div>
                  <div><strong>{t("ID Document:", "شناختی دستاویز:")}</strong> {selectedDonor.id_kind}: {selectedDonor.id_number}</div>
                  <div><strong>{t("Phone:", "فون:")}</strong> {selectedDonor.phone || t("None", "کوئی نہیں")}</div>
                  <div><strong>{t("Lifetime Donations:", "کل عطیات:")}</strong> {selectedDonor.donations_collected || 0}</div>
                  {selectedDonor.last_collected_at && (
                    <div><strong>{t("Last Donation:", "آخری عطیہ:")}</strong> {new Date(selectedDonor.last_collected_at).toLocaleDateString()}</div>
                  )}
                  {selectedDonor.may_donate_from && (
                    <div><strong>{t("May Donate From:", "دوبارہ اہلیت کی تاریخ:")}</strong> {selectedDonor.may_donate_from}</div>
                  )}
                </div>

                {/* Deferral Status Highlights */}
                {selectedDonor.permanently_deferred && (
                  <div
                    role="alert"
                    style={{
                      background: "#fee2e2",
                      border: "1px solid #ef4444",
                      color: "#991b1b",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "6px",
                      marginBottom: "0.75rem",
                      fontSize: "0.8rem",
                      fontWeight: "bold",
                    }}
                  >
                    🚫 {t("PERMANENTLY DEFERRED — DONATION PROHIBITED BY LAW", "مستقل مسترد شدہ — قانوناً خون لینا سختی سے ممنوع ہے")}
                  </div>
                )}

                {selectedDonor.deferred_now && !selectedDonor.permanently_deferred && (
                  <div
                    role="status"
                    style={{
                      background: "#fef3c7",
                      border: "1px solid #f59e0b",
                      color: "#92400e",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "6px",
                      marginBottom: "0.75rem",
                      fontSize: "0.8rem",
                      fontWeight: "bold",
                    }}
                  >
                    ⏳ {t(`TEMPORARILY DEFERRED until ${selectedDonor.may_donate_from || "future"}`, `عارضی التواء — اگلی اہلیت: ${selectedDonor.may_donate_from}`)}
                  </div>
                )}

                {/* Unresolved Reactive Warning (rule:7abf8e8e44) */}
                {selectedDonor.donations?.some((d) => d.status === "Reactive") && (
                  <div
                    role="alert"
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #b91c1c",
                      color: "#b91c1c",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "6px",
                      marginBottom: "0.75rem",
                      fontSize: "0.8rem",
                    }}
                  >
                    ⚠️ {t(
                      "BLOOD_DONOR_REACTIVE_UNRESOLVED: Earlier donation was reactive. Record a deferral before accepting.",
                      "سابقہ عطیہ ری ایکٹیو پایا گیا تھا۔ ڈونر کو قبول کرنے سے قبل ڈاکٹر کا التواء درج کرنا لازمی ہے۔",
                    )}
                  </div>
                )}

                {/* Donor Actions */}
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    data-help="donor_assessment.open_full_donor"
                    onClick={() => setFullDonorModalOpen(true)}
                    style={{ flex: 1, padding: "0.4rem", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "0.8rem", cursor: "pointer" }}
                  >
                    📜 {t("Audit File", "مکمل فائل")}
                  </button>
                  {canWrite && isDoctor && (
                    <button
                      type="button"
                      data-help="donor_assessment.add_deferral_btn"
                      onClick={() => {
                        setStandaloneDeferralDonor(selectedDonor);
                        setStandaloneKind("Temporary");
                        setStandaloneReason("");
                        setStandaloneUntil(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
                        setStandaloneDeferralOpen(true);
                      }}
                      style={{ flex: 1, padding: "0.4rem", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "4px", fontSize: "0.8rem", cursor: "pointer", fontWeight: 500 }}
                    >
                      ⛔ {t("Add Deferral", "التواء درج کریں")}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Assessment Examination Form (rule:91e1708abe, rule:eee718a5dc, rule:a8bf19300f) */}
          <div>
            {!selectedDonor ? (
              <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "2rem", textAlign: "center" }}>
                <Empty>
                  {t("Search and select a blood donor to perform medical assessment.", "طبی معائنہ شروع کرنے کے لیے بائیں جانب سے عطیہ دہندہ تلاش کر کے منتخب کریں۔")}
                </Empty>
              </div>
            ) : view === "records" ? (
              <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "1.5rem" }}>
                <p style={{ color: "#64748b" }}>
                  {t("Screen is in Records mode. New assessments are disabled.", "یہ سکرین صرف ریکارڈز موڈ میں ہے۔ نیا معائنہ معطل ہے۔")}
                </p>
              </div>
            ) : view === "open_work" ? (
              <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "1.5rem" }}>
                <p style={{ color: "#92400e" }}>
                  {t(
                    "Blood Center service is retiring: new assessments cannot be initiated. Review existing donor files or manage deferrals.",
                    "بلڈ سنٹر سروس ختم کی جا رہی ہے: نیا معائنہ شروع نہیں ہو سکتا۔ پرانے ریکارڈ یا التواء کا جائزہ لیں۔",
                  )}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitAssessment} style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "1.25rem" }}>
                <h2 style={{ fontSize: "1.15rem", margin: "0 0 1rem 0", color: "#0f172a", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                  🩺 {t(`Medical Assessment for ${selectedDonor.full_name}`, `${selectedDonor.full_name} کا طبی معائنہ`)}
                </h2>

                {/* Real-time PBTA Eligibility Banner (rule:eee718a5dc) */}
                {eligibility && !eligibility.eligible && (
                  <div
                    role="alert"
                    style={{
                      background: "#fee2e2",
                      border: "1px solid #ef4444",
                      color: "#991b1b",
                      padding: "0.75rem 1rem",
                      borderRadius: "6px",
                      marginBottom: "1rem",
                      fontSize: "0.85rem",
                    }}
                  >
                    <div style={{ fontWeight: "bold", marginBottom: "0.25rem" }}>
                      ⚠️ {t("PBTA Regulatory Eligibility Notice (BLOOD_DONOR_INELIGIBLE):", "پی بی ٹی اے کے ضوابط کے تحت عدم اہلیت کا انتباہ:")}
                    </div>
                    <ul style={{ margin: "0 0 0.5rem 0", paddingLeft: "1.25rem" }}>
                      {eligibility.issues.map((iss, idx) => (
                        <li key={idx}>{iss}</li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      data-help="donor_assessment.switch_deferral_btn"
                      onClick={() => {
                        setOutcome("Deferred");
                        setFormDeferralKind("Temporary");
                        setFormDeferralReason(eligibility.issues[0] || "Eligibility criteria not met");
                      }}
                      style={{
                        padding: "0.3rem 0.65rem",
                        background: "#dc2626",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        fontWeight: 500,
                      }}
                    >
                      ↩ {t("Switch to Deferral with Reason", "التواء کی طرف منتقل کریں اور وجہ درج کریں")}
                    </button>
                  </div>
                )}

                {/* Section 1: Donation Kind & Venue */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "0.25rem" }}>
                      {t("Donation Kind", "عطیہ کی قسم")} *
                    </label>
                    <select
                      data-help="donor_assessment.form_donation_kind"
                      value={donationKind}
                      onChange={(e) => setDonationKind(e.target.value as any)}
                      style={{ width: "100%", padding: "0.45rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                    >
                      <option value="Voluntary">{t("Voluntary Non-Remunerated (PBTA Standard)", "رضاکارانہ بلا معاوضہ (معیار)")}</option>
                      <option value="Replacement">{t("Replacement (Family / Directed)", "متبادل (خاندان / نامزد)")}</option>
                      <option value="Autologous">{t("Autologous (Self)", "ذاتی خون (آٹولوگس)")}</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "0.25rem" }}>
                      {t("Venue", "مقام")} *
                    </label>
                    <select
                      data-help="donor_assessment.form_venue"
                      value={venue}
                      onChange={(e) => setVenue(e.target.value as any)}
                      style={{ width: "100%", padding: "0.45rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                    >
                      <option value="BloodCenter">{t("Blood Center (Fixed Site)", "بلڈ سنٹر (مستقل مرکز)")}</option>
                      <option value="Camp">{t("Mobile Blood Donation Camp", "موبائل بلڈ کیمپ")}</option>
                    </select>
                  </div>
                </div>

                {venue === "Camp" && (
                  <div style={{ marginBottom: "1rem" }}>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "0.25rem" }}>
                      {t("Camp Location / Note", "کیمپ کا مقام / تفصیل")} *
                    </label>
                    <input
                      type="text"
                      data-help="donor_assessment.form_venue_note"
                      placeholder={t("e.g., Punjab University Executive Camp", "مثلاً پنجاب یونیورسٹی کیمپ")}
                      value={venueNote}
                      onChange={(e) => setVenueNote(e.target.value)}
                      style={{ width: "100%", padding: "0.45rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                    />
                  </div>
                )}

                {/* Section 2: Health History Questionnaire */}
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "0.75rem", marginBottom: "1rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontWeight: "bold", fontSize: "0.875rem" }}>
                    <input
                      type="checkbox"
                      data-help="donor_assessment.form_history_completed"
                      checked={historyCompleted}
                      onChange={(e) => setHistoryCompleted(e.target.checked)}
                      style={{ width: "18px", height: "18px" }}
                    />
                    <span>{t("Donor Health History Questionnaire completed and reviewed by Doctor (PBTA Std ch.2 S.2.3) *", "ڈونر کی صحت سے متعلق سوالنامہ مکمل اور ڈاکٹر نے جائزہ لیا (پی بی ٹی اے معیار) *")}</span>
                  </label>
                  <input
                    type="text"
                    data-help="donor_assessment.form_history_note"
                    placeholder={t("Doctor's clinical questionnaire observations (optional)", "ڈاکٹر کے اضافی طبی مشاہدات (اختیاری)")}
                    value={historyNote}
                    onChange={(e) => setHistoryNote(e.target.value)}
                    style={{ width: "100%", marginTop: "0.5rem", padding: "0.4rem", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "0.8rem" }}
                  />
                </div>

                {/* Section 3: Physical Examination & PBTA Normatives (rule:eee718a5dc) */}
                <div style={{ marginBottom: "1rem" }}>
                  <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.5rem 0", color: "#334155" }}>
                    📊 {t("Physical Examination & PBTA Standards", "جسمانی معائنہ اور پی بی ٹی اے کے قانونی معیار")}
                  </h3>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
                    {/* Weight */}
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "bold", marginBottom: "0.2rem" }}>
                        {t("Weight (kg)", "وزن (کلوگرام)")} *
                        <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: "normal", marginLeft: "0.3rem" }}>
                          (≥ 50.0 kg)
                        </span>
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        data-help="donor_assessment.form_weight"
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                        style={{ width: "100%", padding: "0.45rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                      />
                    </div>

                    {/* Haemoglobin */}
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "bold", marginBottom: "0.2rem" }}>
                        {t("Haemoglobin (g/dL)", "ہیموگلوبن (گرام/ڈی ایل)")} *
                        <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: "normal", marginLeft: "0.3rem" }}>
                          ({selectedDonor.sex === "Female" ? "≥ 12.5" : "≥ 13.0"} g/dL)
                        </span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        data-help="donor_assessment.form_hb"
                        value={hbGDl}
                        onChange={(e) => setHbGDl(e.target.value)}
                        style={{ width: "100%", padding: "0.45rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                      />
                    </div>

                    {/* Hb Method */}
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "bold", marginBottom: "0.2rem" }}>
                        {t("Hb Test Method", "ہیموگلوبن کا طریقہ کار")} *
                      </label>
                      <select
                        data-help="donor_assessment.form_hb_method"
                        value={hbMethod}
                        onChange={(e) => setHbMethod(e.target.value as any)}
                        style={{ width: "100%", padding: "0.45rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                      >
                        <option value="Photometer">{t("Photometer (Recommended)", "فوٹومیٹر (تجویز کردہ)")}</option>
                        <option value="CopperSulphate">{t("Copper Sulphate Method", "کاپر سلفیٹ طریقہ")}</option>
                        <option value="Haematocrit">{t("Microhaematocrit", "مائیکرو ہیماٹوکرٹ")}</option>
                        <option value="Analyser">{t("Automated Analyser", "خودکار اینالائزر")}</option>
                      </select>
                    </div>

                    {/* Pulse */}
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "bold", marginBottom: "0.2rem" }}>
                        {t("Pulse (bpm)", "نبض (فی منٹ)")}
                        <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: "normal", marginLeft: "0.3rem" }}>
                          (60–100)
                        </span>
                      </label>
                      <input
                        type="number"
                        data-help="donor_assessment.form_pulse"
                        value={pulse}
                        onChange={(e) => setPulse(e.target.value)}
                        style={{ width: "100%", padding: "0.45rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                      />
                    </div>

                    {/* Blood Pressure Systolic */}
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "bold", marginBottom: "0.2rem" }}>
                        {t("BP Systolic (mmHg)", "بلڈ پریشر سسٹولک")}
                        <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: "normal", marginLeft: "0.3rem" }}>
                          (100–140)
                        </span>
                      </label>
                      <input
                        type="number"
                        data-help="donor_assessment.form_bp_systolic"
                        value={bpSystolic}
                        onChange={(e) => setBpSystolic(e.target.value)}
                        style={{ width: "100%", padding: "0.45rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                      />
                    </div>

                    {/* Blood Pressure Diastolic */}
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "bold", marginBottom: "0.2rem" }}>
                        {t("BP Diastolic (mmHg)", "بلڈ پریشر ڈائیسٹولک")}
                        <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: "normal", marginLeft: "0.3rem" }}>
                          (60–90)
                        </span>
                      </label>
                      <input
                        type="number"
                        data-help="donor_assessment.form_bp_diastolic"
                        value={bpDiastolic}
                        onChange={(e) => setBpDiastolic(e.target.value)}
                        style={{ width: "100%", padding: "0.45rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                      />
                    </div>

                    {/* Temperature */}
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "bold", marginBottom: "0.2rem" }}>
                        {t("Temperature (°C)", "درجہ حرارت (سینٹی گریڈ)")}
                        <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: "normal", marginLeft: "0.3rem" }}>
                          (36.5–37.5)
                        </span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        data-help="donor_assessment.form_temperature"
                        value={temperatureC}
                        onChange={(e) => setTemperatureC(e.target.value)}
                        style={{ width: "100%", padding: "0.45rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: Assessment Outcome Decision */}
                <div style={{ background: "#f1f5f9", borderRadius: "6px", padding: "0.75rem", marginBottom: "1rem" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "0.5rem" }}>
                    {t("Doctor's Assessment Decision Outcome *", "معائنے کا حتمی طبی فیصلہ *")}
                  </label>
                  <div style={{ display: "flex", gap: "1rem" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontWeight: "bold", color: "#15803d" }}>
                      <input
                        type="radio"
                        name="outcome"
                        data-help="donor_assessment.form_outcome_accepted"
                        checked={outcome === "Accepted"}
                        onChange={() => setOutcome("Accepted")}
                        disabled={selectedDonor.permanently_deferred || selectedDonor.deferred_now}
                        style={{ width: "18px", height: "18px" }}
                      />
                      <span>✅ {t("Accepted for Collection", "قبول برائے انتقال خون")}</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontWeight: "bold", color: "#dc2626" }}>
                      <input
                        type="radio"
                        name="outcome"
                        data-help="donor_assessment.form_outcome_deferred"
                        checked={outcome === "Deferred"}
                        onChange={() => setOutcome("Deferred")}
                        style={{ width: "18px", height: "18px" }}
                      />
                      <span>⛔ {t("Deferred (Temporary / Permanent)", "التواء (عارضی یا مستقل)")}</span>
                    </label>
                  </div>
                </div>

                {/* Accepted: Informed Consent & Unpaid Declaration (rule:91e1708abe: separate boxes, NEVER pre-ticked) */}
                {outcome === "Accepted" && (
                  <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "6px", padding: "0.75rem", marginBottom: "1rem" }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#065f46", marginBottom: "0.5rem" }}>
                      ✍️ {t("Mandatory Donor Consents (Must be ticked individually by doctor):", "ڈونر کی لازمی قانونی رضامندی:")}
                    </div>

                    <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.5rem", cursor: "pointer", fontSize: "0.85rem" }}>
                      <input
                        type="checkbox"
                        data-help="donor_assessment.form_consent_signed"
                        checked={consentSigned}
                        onChange={(e) => setConsentSigned(e.target.checked)}
                        style={{ width: "18px", height: "18px", marginTop: "2px" }}
                      />
                      <span>
                        <strong>{t("Informed Written Consent Signed", "باخبر تحریری رضامندی پر دستخط")}:</strong>{" "}
                        {t(
                          "Donor signed the written informed consent prior to collection (PBTA Standard ch.2 S.1.2.4; rule:91e1708abe).",
                          "ڈونر نے خون لینے سے قبل تمام طبی خطرات سمجھ کر تحریری رضامندی پر دستخط کیے ہیں۔",
                        )}
                      </span>
                    </label>

                    <div style={{ marginLeft: "1.75rem", marginBottom: "0.75rem" }}>
                      <label style={{ fontSize: "0.8rem", marginRight: "0.5rem" }}>{t("Consent Language:", "رضامندی کی زبان:")}</label>
                      <select
                        data-help="donor_assessment.form_consent_language"
                        value={consentLanguage}
                        onChange={(e) => setConsentLanguage(e.target.value)}
                        style={{ padding: "0.25rem 0.5rem", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "0.8rem" }}
                      >
                        <option value="Urdu">{t("Urdu", "اردو")}</option>
                        <option value="English">{t("English", "انگریزی")}</option>
                      </select>
                    </div>

                    <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", cursor: "pointer", fontSize: "0.85rem" }}>
                      <input
                        type="checkbox"
                        data-help="donor_assessment.form_unpaid_declared"
                        checked={unpaidDeclared}
                        onChange={(e) => setUnpaidDeclared(e.target.checked)}
                        style={{ width: "18px", height: "18px", marginTop: "2px" }}
                      />
                      <span>
                        <strong>{t("Declaration of No Payment / Non-Remuneration", "بلا معاوضہ ہونے کا قانونی اقرار نامہ")}:</strong>{" "}
                        {t(
                          "Donor declares in writing that donation is strictly voluntary and without any financial payment or compensation (Punjab Blood Transfusion Safety Act 2016 s.2(k); rule:91e1708abe).",
                          "ڈونر نے اقرار کیا کہ خون کا عطیہ مکمل طور پر رضاکارانہ ہے اور اس کے عوض کوئی رقم یا مالی فائدہ نہیں لیا گیا۔",
                        )}
                      </span>
                    </label>
                  </div>
                )}

                {/* Deferred: Deferral Particulars & Told In Private (rule:a8bf19300f) */}
                {outcome === "Deferred" && (
                  <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "6px", padding: "0.75rem", marginBottom: "1rem" }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#9f1239", marginBottom: "0.5rem" }}>
                      ⛔ {t("Deferral Details & Confidential Disclosure (PBTA Act s.10(2)(e)):", "التواء کی تفصیلات اور رازداری سے آگاہی:")}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.5rem" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "bold", marginBottom: "0.2rem" }}>
                          {t("Deferral Kind", "التواء کی نوعیت")} *
                        </label>
                        <select
                          data-help="donor_assessment.deferral_kind"
                          value={formDeferralKind}
                          onChange={(e) => setFormDeferralKind(e.target.value as any)}
                          style={{ width: "100%", padding: "0.45rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                        >
                          <option value="Temporary">{t("Temporary (With End Date)", "عارضی (آخری تاریخ کے ساتھ)")}</option>
                          <option value="Permanent">{t("Permanent (Life)", "مستقل (تاحیات)")}</option>
                        </select>
                      </div>

                      {formDeferralKind === "Temporary" && (
                        <div>
                          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "bold", marginBottom: "0.2rem" }}>
                            {t("Deferred Until Date (Last Day)", "التواء کی آخری تاریخ")} *
                          </label>
                          <input
                            type="date"
                            data-help="donor_assessment.deferral_until"
                            value={formDeferredUntil}
                            onChange={(e) => setFormDeferredUntil(e.target.value)}
                            style={{ width: "100%", padding: "0.45rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                          />
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: "0.5rem" }}>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "bold", marginBottom: "0.2rem" }}>
                        {t("Clinical Reason for Deferral", "التواء کی طبی وجہ")} *
                      </label>
                      <textarea
                        data-help="donor_assessment.deferral_reason"
                        rows={2}
                        value={formDeferralReason}
                        onChange={(e) => setFormDeferralReason(e.target.value)}
                        placeholder={t("Document detailed clinical deferral reason (min 3 chars)", "طبی التواء کی واضح وجہ درج کریں")}
                        style={{ width: "100%", padding: "0.45rem", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "0.85rem" }}
                      />
                    </div>

                    {/* Standard PBTA Deferral Guidance Chips */}
                    <div style={{ marginBottom: "0.75rem" }}>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>
                        {t("PBTA Guidance Aids (click to insert):", "پی بی ٹی اے رہنمائی (کلک کر کے منتخب کریں):")}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                        {(formDeferralKind === "Temporary"
                          ? PBTA_TEMPORARY_DEFERRAL_GUIDANCE
                          : PBTA_PERMANENT_DEFERRAL_GUIDANCE
                        ).map((item, idx) => (
                          <button
                            key={idx}
                            type="button"
                            data-help="donor_assessment.deferral_guidance_chip"
                            onClick={() => {
                              setFormDeferralReason(item.reason);
                              if (formDeferralKind === "Temporary" && "defaultDays" in item) {
                                const days = (item as { defaultDays: number }).defaultDays || 30;
                                const end = new Date(Date.now() + days * 86400000)
                                  .toISOString()
                                  .slice(0, 10);
                                setFormDeferredUntil(end);
                              }
                            }}
                            style={{
                              background: "#f1f5f9",
                              border: "1px solid #cbd5e1",
                              borderRadius: "12px",
                              padding: "0.15rem 0.5rem",
                              fontSize: "0.7rem",
                              cursor: "pointer",
                              color: "#334155",
                            }}
                          >
                            + {item.reason}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Told Now In Private Fields */}
                    <div style={{ borderTop: "1px solid #fecdd3", paddingTop: "0.5rem" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontWeight: "bold", fontSize: "0.85rem", marginBottom: "0.4rem" }}>
                        <input
                          type="checkbox"
                          data-help="donor_assessment.deferral_told_toggle"
                          checked={formToldNow}
                          onChange={(e) => setFormToldNow(e.target.checked)}
                          style={{ width: "16px", height: "16px" }}
                        />
                        <span>{t("Told now in private (Record confidential disclosure to donor)", "رازداری سے مطلع کیا گیا (ڈونر کو بتانے کا اندراج)")}</span>
                      </label>

                      {formToldNow && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
                          <div>
                            <label style={{ fontSize: "0.75rem", fontWeight: "bold", display: "block" }}>{t("Communication Method", "طریقہ کار")}</label>
                            <select
                              data-help="donor_assessment.deferral_communication"
                              value={formCommunication}
                              onChange={(e) => setFormCommunication(e.target.value as any)}
                              style={{ width: "100%", padding: "0.3rem", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "0.8rem" }}
                            >
                              <option value="InPerson">{t("In Person (Face-to-face)", "روبرو / بالمشافہ")}</option>
                              <option value="Phone">{t("Confidential Phone", "فون پر")}</option>
                              <option value="Letter">{t("Confidential Letter", "تحریری خط")}</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ fontSize: "0.75rem", fontWeight: "bold", display: "block" }}>{t("Counselled", "کونسلنگ کی گئی")}</label>
                            <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "0.3rem", fontSize: "0.8rem" }}>
                              <input
                                type="checkbox"
                                data-help="donor_assessment.deferral_counselled"
                                checked={formCounselled}
                                onChange={(e) => setFormCounselled(e.target.checked)}
                              />
                              <span>{t("Counselled in private", "کونسلنگ مکمل")}</span>
                            </label>
                          </div>

                          <div>
                            <label style={{ fontSize: "0.75rem", fontWeight: "bold", display: "block" }}>{t("Referred To (Lab/Clinic)", "ریفر کردہ مرکز")}</label>
                            <input
                              type="text"
                              data-help="donor_assessment.deferral_referred_to"
                              placeholder={t("e.g., Reference Lab", "مثلاً ریفرنس لیب")}
                              value={formReferredTo}
                              onChange={(e) => setFormReferredTo(e.target.value)}
                              style={{ width: "100%", padding: "0.3rem", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "0.8rem" }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Form Submit Button (Idempotent write) (rule:eef3feb4b9) */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
                  <button
                    type="submit"
                    data-help="donor_assessment.form_submit"
                    disabled={!canAssessNew || write.busy}
                    style={{
                      padding: "0.6rem 1.5rem",
                      background: outcome === "Accepted" ? "#16a34a" : "#dc2626",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      fontWeight: "bold",
                      fontSize: "0.95rem",
                      cursor: canAssessNew ? "pointer" : "not-allowed",
                      opacity: canAssessNew ? 1 : 0.6,
                    }}
                  >
                    {write.busy
                      ? t("Saving Assessment...", "معائنہ محفوظ ہو رہا ہے...")
                      : outcome === "Accepted"
                      ? t("Accept & Issue Donation (POST /blood-center/donations)", "قبول کریں اور عطیہ جاری کریں")
                      : t("Record Deferral Decision", "التواء کا فیصلہ درج کریں")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: REACTIVE WORKLIST (rule:d8cd988a65) */}
      {activeTab === "reactive" && (
        <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <h2 style={{ fontSize: "1.15rem", margin: "0 0 0.25rem 0", color: "#0f172a" }}>
                ⚠️ {t("Reactive Donations Worklist", "رد عمل کا شکار عطیات کی فہرست")}
              </h2>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
                {t(
                  "GET /blood-center/donations?status=Reactive · PBTA requirement: Disclose reactive results in private, counsel donor, and record permanent deferral.",
                  "پی بی ٹی اے ضابطہ: ری ایکٹیو نتائج رازداری میں بتائیں، کونسلنگ کریں اور مستقل التواء درج کریں۔",
                )}
              </p>
            </div>
            <span style={{ fontSize: "0.85rem", color: "#475569" }}>
              {reactiveWorklist.data ? `${reactiveWorklist.data.length} ${t("reactive cases", "کیسز")}` : ""}
            </span>
          </div>

          {reactiveWorklist.loading && <LoadState loading={true} error={null} retry={() => setRevision((r) => r + 1)} />}
          {Boolean(reactiveWorklist.error) && <ErrorBox error={reactiveWorklist.error} />}

          {reactiveWorklist.data && reactiveWorklist.data.length === 0 && (
            <div style={{ padding: "2rem", textAlign: "center" }}>
              <Empty>
                {t("No donations currently flagged as Reactive.", "اس وقت کوئی عطیہ رد عمل (ری ایکٹیو) کی فہرست میں نہیں ہے۔")}
              </Empty>
            </div>
          )}

          {reactiveWorklist.data && reactiveWorklist.data.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1", textAlign: "left" }}>
                  <th style={{ padding: "0.6rem" }}>{t("Donation #", "عطیہ نمبر")}</th>
                  <th style={{ padding: "0.6rem" }}>{t("Donor", "عطیہ دہندہ")}</th>
                  <th style={{ padding: "0.6rem" }}>{t("Collection Date", "تاریخ جمع")}</th>
                  <th style={{ padding: "0.6rem" }}>{t("Reactive Screening Markers", "مثبت اسکریننگ مارکرز")}</th>
                  <th style={{ padding: "0.6rem" }}>{t("Actions", "اقدامات")}</th>
                </tr>
              </thead>
              <tbody>
                {reactiveWorklist.data.map((donation) => (
                  <tr key={donation.donation_id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "0.6rem", fontWeight: "bold" }}>{donation.donation_number}</td>
                    <td style={{ padding: "0.6rem" }}>
                      <div>{donation.donor_number} ({donation.donor_sex}, {donation.age_years}y)</div>
                      <button
                        type="button"
                        data-help="donor_assessment.reactive_open_donor"
                        onClick={() => selectDonorById(donation.donor_id).then(() => setActiveTab("assess"))}
                        style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: "0.75rem", padding: 0 }}
                      >
                        {t("Open Donor File →", "ڈونر فائل کھولیں →")}
                      </button>
                    </td>
                    <td style={{ padding: "0.6rem" }}>
                      {new Date(donation.attended_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "0.6rem" }}>
                      <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                        {donation.reactive_markers?.length > 0 ? (
                          donation.reactive_markers.map((m) => (
                            <span
                              key={m}
                              style={{
                                background: "#fee2e2",
                                color: "#991b1b",
                                border: "1px solid #f87171",
                                padding: "0.15rem 0.45rem",
                                borderRadius: "4px",
                                fontWeight: "bold",
                                fontSize: "0.75rem",
                              }}
                            >
                              ⚠️ {m}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: "#dc2626", fontWeight: "bold" }}>Reactive</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "0.6rem" }}>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <button
                          type="button"
                          data-help="donor_assessment.reactive_inspect"
                          onClick={() => openDonationInspection(donation.donation_id)}
                          style={{
                            padding: "0.35rem 0.65rem",
                            background: "#f1f5f9",
                            border: "1px solid #cbd5e1",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                          }}
                        >
                          🔍 {t("Inspect", "جائزہ")}
                        </button>
                        {canWrite && isDoctor && (
                          <button
                            type="button"
                            data-help="donor_assessment.reactive_tell_button"
                            onClick={() => {
                              getDonor(donation.donor_id).then((d) => {
                                setStandaloneDeferralDonor(d);
                                setStandaloneKind("Permanent");
                                setStandaloneDonationId(donation.donation_id);
                                setStandaloneReason(
                                  donation.reactive_markers?.length
                                    ? `Repeat reactive on screening: ${donation.reactive_markers.join(", ")}`
                                    : "Repeat reactive on TTI screening",
                                );
                                setStandaloneTold(true);
                                setStandaloneCommunication("InPerson");
                                setStandaloneCounselled(true);
                                setStandaloneReferredTo("Provincial Reference Laboratory, Lahore");
                                setStandaloneDeferralOpen(true);
                              });
                            }}
                            style={{
                              padding: "0.35rem 0.65rem",
                              background: "#dc2626",
                              color: "#fff",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                              fontWeight: 500,
                            }}
                          >
                            🤫 {t("Inform & Defer in Private", "رازداری سے آگاہ اور التواء")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB 3: DONATION HISTORY & AUDIT */}
      {activeTab === "donors" && (
        <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <h2 style={{ fontSize: "1.15rem", margin: "0 0 0.25rem 0", color: "#0f172a" }}>
                📋 {t("Donations Audit Directory", "عطیات کا مکمل آڈٹ رجسٹر")}
              </h2>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
                {t("Comprehensive journey from assessment to testing, components, and transfusion.", "معائنے سے ٹیسٹنگ، اجزاء اور انتقال خون تک تمام مراحل۔")}
              </p>
            </div>

            {/* Filter controls */}
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <select
                data-help="donor_assessment.filter_status"
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                style={{ padding: "0.4rem", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "0.8rem" }}
              >
                <option value="All">{t("All Statuses", "تمام حالتیں")}</option>
                <option value="Accepted">{t("Accepted", "قبول")}</option>
                <option value="Deferred">{t("Deferred", "موخر")}</option>
                <option value="Collected">{t("Collected", "جمع شدہ")}</option>
                <option value="Cleared">{t("Cleared", "کلیئر شدہ")}</option>
                <option value="Reactive">{t("Reactive", "ری ایکٹیو")}</option>
                <option value="Rejected">{t("Rejected", "مسترد")}</option>
              </select>

              <input
                type="date"
                data-help="donor_assessment.filter_date_from"
                value={historyDateFrom}
                onChange={(e) => setHistoryDateFrom(e.target.value)}
                placeholder="From"
                style={{ padding: "0.4rem", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "0.8rem" }}
              />

              <input
                type="date"
                data-help="donor_assessment.filter_date_to"
                value={historyDateTo}
                onChange={(e) => setHistoryDateTo(e.target.value)}
                placeholder="To"
                style={{ padding: "0.4rem", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "0.8rem" }}
              />
            </div>
          </div>

          {donationsHistory.loading && <LoadState loading={true} error={null} retry={() => setRevision((r) => r + 1)} />}
          {Boolean(donationsHistory.error) && <ErrorBox error={donationsHistory.error} />}

          {donationsHistory.data && donationsHistory.data.length === 0 && (
            <div style={{ padding: "2rem", textAlign: "center" }}>
              <Empty>
                {t("No donation records found matching criteria.", "کوئی عطیہ ریکارڈ نہیں ملا۔")}
              </Empty>
            </div>
          )}

          {donationsHistory.data && donationsHistory.data.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1", textAlign: "left" }}>
                  <th style={{ padding: "0.6rem" }}>{t("Donation #", "عطیہ نمبر")}</th>
                  <th style={{ padding: "0.6rem" }}>{t("Donor", "ڈونر")}</th>
                  <th style={{ padding: "0.6rem" }}>{t("Attended Date", "تاریخ حاضری")}</th>
                  <th style={{ padding: "0.6rem" }}>{t("Kind / Venue", "قسم / مقام")}</th>
                  <th style={{ padding: "0.6rem" }}>{t("Status", "حالت")}</th>
                  <th style={{ padding: "0.6rem" }}>{t("Hb / Vitals", "ہیموگلوبن / علامات")}</th>
                  <th style={{ padding: "0.6rem" }}>{t("Actions", "اقدامات")}</th>
                </tr>
              </thead>
              <tbody>
                {donationsHistory.data.map((d) => (
                  <tr key={d.donation_id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "0.6rem", fontWeight: "bold" }}>{d.donation_number}</td>
                    <td style={{ padding: "0.6rem" }}>{d.donor_number}</td>
                    <td style={{ padding: "0.6rem" }}>{new Date(d.attended_at).toLocaleDateString()}</td>
                    <td style={{ padding: "0.6rem" }}>{d.donation_kind} · {d.venue}</td>
                    <td style={{ padding: "0.6rem" }}>
                      <span
                        style={{
                          padding: "0.2rem 0.5rem",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: "bold",
                          background:
                            d.status === "Cleared"
                              ? "#ecfdf5"
                              : d.status === "Reactive"
                              ? "#fee2e2"
                              : d.status === "Deferred"
                              ? "#fef3c7"
                              : "#f1f5f9",
                          color:
                            d.status === "Cleared"
                              ? "#065f46"
                              : d.status === "Reactive"
                              ? "#991b1b"
                              : d.status === "Deferred"
                              ? "#92400e"
                              : "#334155",
                        }}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td style={{ padding: "0.6rem" }}>
                      Hb: {d.hb_g_dl} g/dL
                      {d.pulse && ` · Pulse: ${d.pulse}`}
                    </td>
                    <td style={{ padding: "0.6rem" }}>
                      <button
                        type="button"
                        data-help="donor_assessment.inspect_donation"
                        onClick={() => openDonationInspection(d.donation_id)}
                        style={{
                          padding: "0.3rem 0.6rem",
                          background: "#2563eb",
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.75rem",
                        }}
                      >
                        {t("Inspect Details", "تفصیلات دیکھیں")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* MODAL 1: Standalone Deferral Modal (POST /blood-center/donors/{id}/deferrals) */}
      {standaloneDeferralOpen && standaloneDeferralDonor && (
        <Modal
          title={t(`Record Deferral for ${standaloneDeferralDonor.full_name}`, `${standaloneDeferralDonor.full_name} کا التواء درج کریں`)}
          onClose={() => setStandaloneDeferralOpen(false)}
        >
          <form onSubmit={handleStandaloneDeferralSubmit} style={{ minWidth: "460px" }}>
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "0.25rem" }}>
                {t("Deferral Kind", "التواء کی نوعیت")} *
              </label>
              <select
                data-help="donor_assessment.modal_deferral_kind"
                value={standaloneKind}
                onChange={(e) => setStandaloneKind(e.target.value as any)}
                style={{ width: "100%", padding: "0.45rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}
              >
                <option value="Temporary">{t("Temporary (With Last Day)", "عارضی (آخری تاریخ کے ساتھ)")}</option>
                <option value="Permanent">{t("Permanent (Life)", "مستقل (تاحیات)")}</option>
              </select>
            </div>

            {standaloneKind === "Temporary" && (
              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "0.25rem" }}>
                  {t("Deferred Until (Last Day)", "التواء کی آخری تاریخ")} *
                </label>
                <input
                  type="date"
                  data-help="donor_assessment.modal_deferral_until"
                  value={standaloneUntil}
                  onChange={(e) => setStandaloneUntil(e.target.value)}
                  style={{ width: "100%", padding: "0.45rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                />
              </div>
            )}

            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "0.25rem" }}>
                {t("Clinical Reason", "طبی وجہ")} *
              </label>
              <textarea
                rows={3}
                data-help="donor_assessment.modal_deferral_reason"
                value={standaloneReason}
                onChange={(e) => setStandaloneReason(e.target.value)}
                placeholder={t("Detailed clinical reason (min 3 chars)", "طبی التواء کی واضح وجہ درج کریں")}
                style={{ width: "100%", padding: "0.45rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}
              />
            </div>

            {/* Told In Private Section */}
            <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "6px", marginBottom: "1rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontWeight: "bold", fontSize: "0.85rem" }}>
                <input
                  type="checkbox"
                  data-help="donor_assessment.modal_deferral_told_check"
                  checked={standaloneTold}
                  onChange={(e) => setStandaloneTold(e.target.checked)}
                />
                <span>{t("Disclose and counsel donor in private now", "ڈونر کو رازداری سے ابھی مطلع اور کونسل کریں")}</span>
              </label>

              {standaloneTold && (
                <div style={{ marginTop: "0.5rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <div>
                      <label style={{ fontSize: "0.75rem", fontWeight: "bold" }}>{t("Method", "طریقہ")}</label>
                      <select
                        data-help="donor_assessment.modal_deferral_comm"
                        value={standaloneCommunication}
                        onChange={(e) => setStandaloneCommunication(e.target.value as any)}
                        style={{ width: "100%", padding: "0.3rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                      >
                        <option value="InPerson">{t("In Person", "بالمشافہ")}</option>
                        <option value="Phone">{t("Phone", "فون")}</option>
                        <option value="Letter">{t("Letter", "خط")}</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "0.75rem", fontWeight: "bold" }}>{t("Referred Lab", "ریفر کردہ لیب")}</label>
                      <input
                        type="text"
                        data-help="donor_assessment.modal_deferral_ref"
                        placeholder="e.g. Reference Lab"
                        value={standaloneReferredTo}
                        onChange={(e) => setStandaloneReferredTo(e.target.value)}
                        style={{ width: "100%", padding: "0.3rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                data-help="donor_assessment.modal_deferral_cancel"
                onClick={() => setStandaloneDeferralOpen(false)}
                style={{ padding: "0.45rem 0.85rem", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "4px", cursor: "pointer" }}
              >
                {t("Cancel", "منسوخ")}
              </button>
              <button
                type="submit"
                data-help="donor_assessment.modal_deferral_submit"
                disabled={write.busy}
                style={{ padding: "0.45rem 1rem", background: "#dc2626", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
              >
                {write.busy ? t("Saving...", "محفوظ ہو رہا ہے...") : t("Save Deferral", "التواء محفوظ کریں")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 2: Inform Deferral Modal (POST /blood-center/deferrals/{id}/inform) */}
      {informModalOpen && (
        <Modal
          title={t("Record How Donor Was Told in Private", "ڈونر کو آگاہ کرنے کی تفصیلات")}
          onClose={() => setInformModalOpen(false)}
        >
          <form onSubmit={handleInformSubmit} style={{ minWidth: "400px" }}>
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "0.25rem" }}>
                {t("Communication Method", "طریقہ کار")} *
              </label>
              <select
                data-help="donor_assessment.inform_communication"
                value={informCommunication}
                onChange={(e) => setInformCommunication(e.target.value as any)}
                style={{ width: "100%", padding: "0.45rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}
              >
                <option value="InPerson">{t("In Person (Face to face)", "بالمشافہ")}</option>
                <option value="Phone">{t("Phone Call", "فون کال")}</option>
                <option value="Letter">{t("Letter", "تحریری خط")}</option>
              </select>
            </div>

            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "0.25rem" }}>
                {t("Communicated Time", "آگاہ کرنے کا وقت")} *
              </label>
              <input
                type="datetime-local"
                data-help="donor_assessment.inform_time"
                value={informTime}
                onChange={(e) => setInformTime(e.target.value)}
                style={{ width: "100%", padding: "0.45rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}
              />
            </div>

            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontSize: "0.85rem" }}>
                <input
                  type="checkbox"
                  data-help="donor_assessment.inform_counselled"
                  checked={informCounselled}
                  onChange={(e) => setInformCounselled(e.target.checked)}
                />
                <span>{t("Donor was counselled in private by the doctor", "ڈاکٹر نے رازداری میں ڈونر کی مکمل کونسلنگ کی")}</span>
              </label>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "0.25rem" }}>
                {t("Referred To (Diagnostic Laboratory)", "ریفر کردہ تشخیصی لیبارٹری")}
              </label>
              <input
                type="text"
                data-help="donor_assessment.inform_referred_to"
                value={informReferredTo}
                onChange={(e) => setInformReferredTo(e.target.value)}
                placeholder={t("e.g., Provincial Reference Lab, Lahore", "مثلاً پراونشل ریفرنس لیب")}
                style={{ width: "100%", padding: "0.45rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                data-help="donor_assessment.modal_inform_cancel"
                onClick={() => setInformModalOpen(false)}
                style={{ padding: "0.45rem 0.85rem", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "4px", cursor: "pointer" }}
              >
                {t("Cancel", "منسوخ")}
              </button>
              <button
                type="submit"
                data-help="donor_assessment.modal_inform_submit"
                disabled={write.busy}
                style={{ padding: "0.45rem 1rem", background: "#2563eb", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
              >
                {write.busy ? t("Saving...", "محفوظ ہو رہا ہے...") : t("Save Communication", "اندراج مکمل کریں")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 3: Revoke Deferral Modal (POST /blood-center/deferrals/{id}/revoke) (rule:d8cd988a65) */}
      {revokeModalOpen && revokeDeferralTarget && (
        <Modal
          title={t("Revoke Deferral Entered in Error", "غلطی سے درج شدہ التواء منسوخ کریں")}
          onClose={() => setRevokeModalOpen(false)}
        >
          <form onSubmit={handleRevokeSubmit} style={{ minWidth: "420px" }}>
            <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", padding: "0.75rem", borderRadius: "6px", marginBottom: "0.75rem", fontSize: "0.8rem", color: "#92400e" }}>
              ⚠️ {t(
                "PBTA Standard S.2.3: Revoking a deferral is audited. It is permitted ONLY when entered in error (e.g. misattributed lab reading). Reason is mandatory.",
                "پی بی ٹی اے معیار: التواء صرف غلط اندراج کی صورت میں منسوخ کیا جا سکتا ہے اور ٹھوس وجہ لکھنا لازمی ہے۔",
              )}
            </div>

            <div style={{ marginBottom: "0.75rem", fontSize: "0.85rem" }}>
              <strong>{t("Original Reason:", "اصل التواء کی وجہ:")}</strong> {revokeDeferralTarget.reason}
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "0.25rem" }}>
                {t("Reason Why Deferral Was Entered in Error", "التواء کے غلط ہونے کی باضابطہ وجہ")} *
              </label>
              <textarea
                rows={3}
                data-help="donor_assessment.revoke_reason"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder={t("Detailed explanation (min 5 characters)", "تفصیلی وضاحت درج کریں (کم از کم 5 حروف)")}
                style={{ width: "100%", padding: "0.45rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                data-help="donor_assessment.modal_revoke_cancel"
                onClick={() => setRevokeModalOpen(false)}
                style={{ padding: "0.45rem 0.85rem", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "4px", cursor: "pointer" }}
              >
                {t("Cancel", "منسوخ")}
              </button>
              <button
                type="submit"
                data-help="donor_assessment.modal_revoke_submit"
                disabled={write.busy}
                style={{ padding: "0.45rem 1rem", background: "#dc2626", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
              >
                {write.busy ? t("Revoking...", "منسوخ ہو رہا ہے...") : t("Confirm Revoke", "منسوخی کی تصدیق")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 4: Full Donation Details Inspection (GET /blood-center/donations/{id}) */}
      {inspectedDonation && (
        <Modal
          title={t(`Inspection of Donation #${inspectedDonation.donation_number}`, `عطیہ نمبر #${inspectedDonation.donation_number} کا مکمل جائزہ`)}
          onClose={() => setInspectedDonation(null)}
        >
          <div style={{ maxWidth: "800px", maxHeight: "75vh", overflowY: "auto", fontSize: "0.875rem" }}>
            {/* Header info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", background: "#f8fafc", padding: "0.75rem", borderRadius: "6px", marginBottom: "1rem" }}>
              <div>
                <div><strong>{t("Donor #:", "ڈونر نمبر:")}</strong> {inspectedDonation.donor_number} ({inspectedDonation.donor_sex}, {inspectedDonation.age_years}y)</div>
                <div><strong>{t("Attended:", "تاریخ حاضری:")}</strong> {new Date(inspectedDonation.attended_at).toLocaleString()}</div>
                <div><strong>{t("Kind / Venue:", "قسم / مقام:")}</strong> {inspectedDonation.donation_kind} · {inspectedDonation.venue}</div>
              </div>
              <div>
                <div><strong>{t("Status:", "حالت:")}</strong> <span style={{ fontWeight: "bold" }}>{inspectedDonation.status}</span></div>
                {inspectedDonation.abo && (
                  <div><strong>{t("Blood Group:", "بلڈ گروپ:")}</strong> {inspectedDonation.abo} {inspectedDonation.rh}</div>
                )}
                {inspectedDonation.volume_ml && (
                  <div><strong>{t("Volume Collected:", "جمع شدہ مقدار:")}</strong> {inspectedDonation.volume_ml} mL ({inspectedDonation.bag_type || "Bag"})</div>
                )}
              </div>
            </div>

            {/* Doctor's Assessment Stamp */}
            <div style={{ background: "#ecfdf5", padding: "0.5rem 0.75rem", borderRadius: "4px", marginBottom: "1rem", fontSize: "0.8rem", color: "#065f46" }}>
              <strong>{t("Assessed by:", "معائنہ کنندہ ڈاکٹر:")}</strong> {inspectedDonation.assessed_stamp?.text || "Staff Doctor"}
            </div>

            {/* Screening Tests */}
            <h3 style={{ fontSize: "0.95rem", margin: "1rem 0 0.5rem 0" }}>
              🔬 {t("Screening Tests", "اسکریننگ ٹیسٹ")} ({inspectedDonation.tests?.length || 0})
            </h3>
            {inspectedDonation.tests && inspectedDonation.tests.length > 0 ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", marginBottom: "1rem" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                    <th style={{ padding: "0.4rem" }}>{t("Marker", "مارکر")}</th>
                    <th style={{ padding: "0.4rem" }}>{t("Method", "طریقہ")}</th>
                    <th style={{ padding: "0.4rem" }}>{t("Kit Lot", "کٹ لاٹ")}</th>
                    <th style={{ padding: "0.4rem" }}>{t("Result", "نتیجہ")}</th>
                    <th style={{ padding: "0.4rem" }}>{t("Tested By", "جانچ کنندہ")}</th>
                  </tr>
                </thead>
                <tbody>
                  {inspectedDonation.tests.map((tst) => (
                    <tr key={tst.test_id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "0.4rem", fontWeight: "bold" }}>{tst.marker}</td>
                      <td style={{ padding: "0.4rem" }}>{tst.method} ({tst.sample})</td>
                      <td style={{ padding: "0.4rem" }}>{tst.kit_lot || "—"}</td>
                      <td style={{ padding: "0.4rem" }}>
                        <span style={{ color: tst.result === "Reactive" ? "#dc2626" : "#16a34a", fontWeight: "bold" }}>
                          {tst.result}
                        </span>
                      </td>
                      <td style={{ padding: "0.4rem", fontSize: "0.75rem" }}>{tst.tested_stamp?.name || tst.tested_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.8rem" }}>{t("No laboratory screening tests recorded yet.", "ابھی کوئی لیب اسکریننگ ریکارڈ نہیں ہوئی۔")}</p>
            )}

            {/* Components Prepared */}
            <h3 style={{ fontSize: "0.95rem", margin: "1rem 0 0.5rem 0" }}>
              🩸 {t("Components Prepared", "تیار کردہ اجزاء")} ({inspectedDonation.components?.length || 0})
            </h3>
            {inspectedDonation.components && inspectedDonation.components.length > 0 ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", marginBottom: "1rem" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                    <th style={{ padding: "0.4rem" }}>{t("Component", "جزو")}</th>
                    <th style={{ padding: "0.4rem" }}>{t("Volume", "حجم")}</th>
                    <th style={{ padding: "0.4rem" }}>{t("Status", "حالت")}</th>
                    <th style={{ padding: "0.4rem" }}>{t("Expiry", "میعاد")}</th>
                  </tr>
                </thead>
                <tbody>
                  {inspectedDonation.components.map((comp) => (
                    <tr key={comp.component_id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "0.4rem", fontWeight: "bold" }}>{comp.component}</td>
                      <td style={{ padding: "0.4rem" }}>{comp.volume_ml} mL</td>
                      <td style={{ padding: "0.4rem" }}>{comp.status}</td>
                      <td style={{ padding: "0.4rem" }}>{new Date(comp.expires_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.8rem" }}>{t("No components separated.", "اجزاء کی تیاری کا اندراج نہیں ہوا۔")}</p>
            )}

            {/* Deferrals on this donation */}
            {inspectedDonation.deferrals && inspectedDonation.deferrals.length > 0 && (
              <div style={{ marginTop: "1rem", borderTop: "1px solid #e2e8f0", paddingTop: "0.5rem" }}>
                <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.5rem 0", color: "#dc2626" }}>
                  ⛔ {t("Deferrals Associated with this Donation", "اس عطیہ سے متعلق التواء")}
                </h3>
                {inspectedDonation.deferrals.map((def) => (
                  <div key={def.deferral_id} style={{ background: "#fff1f2", border: "1px solid #fecdd3", padding: "0.5rem", borderRadius: "4px", marginBottom: "0.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong>{def.kind} Deferral: {def.reason}</strong>
                      {def.in_force ? (
                        <span style={{ color: "#dc2626", fontWeight: "bold" }}>In Force</span>
                      ) : (
                        <span style={{ color: "#64748b" }}>Revoked</span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
                      Decided by: {def.decided_stamp?.text || def.decided_by}
                    </div>
                    {def.in_force && canWrite && isDoctor && (
                      <button
                        type="button"
                        data-help="donor_assessment.revoke_deferral_btn"
                        onClick={() => {
                          setRevokeDeferralTarget(def);
                          setRevokeReason("");
                          setRevokeModalOpen(true);
                        }}
                        style={{ marginTop: "0.4rem", padding: "0.2rem 0.5rem", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "4px", fontSize: "0.75rem", cursor: "pointer" }}
                      >
                        ⚠️ {t("Revoke (Entered in Error)", "منسوخ کریں (غلط اندراج)")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* MODAL 5: Full Lifetime Donor Audit Record (GET /blood-center/donors/{id}) */}
      {fullDonorModalOpen && selectedDonor && (
        <Modal
          title={t(`Lifetime Donor Audit File: ${selectedDonor.full_name}`, `${selectedDonor.full_name} کا مکمل ریکارڈ`)}
          onClose={() => setFullDonorModalOpen(false)}
        >
          <div style={{ maxWidth: "750px", maxHeight: "75vh", overflowY: "auto", fontSize: "0.875rem" }}>
            <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "6px", marginBottom: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <div><strong>{t("Donor #:", "ڈونر نمبر:")}</strong> {selectedDonor.donor_number}</div>
                <div><strong>{t("Full Name:", "پورا نام:")}</strong> {selectedDonor.full_name}</div>
                <div><strong>{t("CNIC / ID:", "شناختی دستاویز:")}</strong> {selectedDonor.id_kind}: {selectedDonor.id_number}</div>
                <div><strong>{t("Sex / DOB:", "جنس / پیدائش:")}</strong> {selectedDonor.sex} · {selectedDonor.date_of_birth} ({selectedDonor.age_years}y)</div>
                <div><strong>{t("Phone:", "فون:")}</strong> {selectedDonor.phone || "—"}</div>
                <div><strong>{t("Email:", "ای میل:")}</strong> {selectedDonor.email || "—"}</div>
              </div>
            </div>

            {/* Historical Deferrals list */}
            <h3 style={{ fontSize: "0.95rem", margin: "1rem 0 0.5rem 0" }}>
              ⛔ {t("Lifetime Deferral History", "التواء کا تاریخی ریکارڈ")} ({selectedDonor.deferrals?.length || 0})
            </h3>
            {selectedDonor.deferrals && selectedDonor.deferrals.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
                {selectedDonor.deferrals.map((def) => (
                  <div
                    key={def.deferral_id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "6px",
                      padding: "0.6rem",
                      background: def.in_force ? "#fff1f2" : "#f8fafc",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <strong>{def.kind} Deferral: {def.reason}</strong>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                          {t("Decided:", "فیصلہ:")} {new Date(def.decided_at).toLocaleDateString()} · {def.decided_stamp?.text || def.decided_by}
                        </div>
                        {def.deferred_until && (
                          <div style={{ fontSize: "0.75rem", color: "#991b1b" }}>
                            {t("Until:", "مدت:")} {def.deferred_until}
                          </div>
                        )}
                      </div>
                      <div>
                        {def.in_force ? (
                          <span style={{ background: "#dc2626", color: "#fff", padding: "0.15rem 0.4rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "bold" }}>
                            Active
                          </span>
                        ) : (
                          <span style={{ background: "#cbd5e1", color: "#334155", padding: "0.15rem 0.4rem", borderRadius: "4px", fontSize: "0.75rem" }}>
                            Revoked
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Communication record */}
                    <div style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "#475569" }}>
                      {def.communicated_at ? (
                        <span>
                          📢 {t(`Told via ${def.communication} on ${new Date(def.communicated_at).toLocaleDateString()}`, `آگاہی بذریعہ ${def.communication}`)}
                          {def.counselled && ` · ${t("Counselled", "کونسلنگ شدہ")}`}
                          {def.referred_to && ` · ${t(`Referred to: ${def.referred_to}`, `ریفر کردہ: ${def.referred_to}`)}`}
                        </span>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ color: "#d97706" }}>⚠️ {t("Not yet communicated in private", "ابھی تک رازداری سے آگاہ نہیں کیا گیا")}</span>
                          {canWrite && isDoctor && def.in_force && (
                            <button
                              type="button"
                              data-help="donor_assessment.donor_audit_inform_btn"
                              onClick={() => {
                                setInformDeferralId(def.deferral_id);
                                setInformModalOpen(true);
                              }}
                              style={{ padding: "0.15rem 0.45rem", background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: "4px", fontSize: "0.75rem", cursor: "pointer" }}
                            >
                              ✍️ {t("Record Disclosure", "آگاہی درج کریں")}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Revocation notice or button */}
                    {def.revoked_at ? (
                      <div style={{ marginTop: "0.3rem", fontSize: "0.75rem", color: "#64748b", fontStyle: "italic" }}>
                        ↩ {t(`Revoked on ${new Date(def.revoked_at).toLocaleDateString()}: "${def.revoke_reason}"`, `منسوخ شدہ: "${def.revoke_reason}"`)}
                      </div>
                    ) : (
                      canWrite && isDoctor && def.in_force && (
                        <div style={{ marginTop: "0.4rem" }}>
                          <button
                            type="button"
                            data-help="donor_assessment.donor_audit_revoke_btn"
                            onClick={() => {
                              setRevokeDeferralTarget(def);
                              setRevokeReason("");
                              setRevokeModalOpen(true);
                            }}
                            style={{ padding: "0.15rem 0.45rem", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "4px", fontSize: "0.75rem", cursor: "pointer" }}
                          >
                            ⚠️ {t("Revoke (Entered in Error)", "منسوخ کریں (غلط اندراج)")}
                          </button>
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.8rem" }}>{t("No deferrals on record.", "کوئی التواء درج نہیں ہے۔")}</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
