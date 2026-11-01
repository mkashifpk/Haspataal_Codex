import React, { useEffect, useState, useMemo } from "react";
import {
  Empty,
  LoadState,
  useLoad,
} from "../components";
import { bilingual as t } from "../i18n";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import type {
  DeathRegisterRowOut,
  DeathRecordOut,
  BodyReleaseIn,
  PrintOut_DeathPrintFieldsOut_,
} from "../generated/body_release_ward";
import {
  deathRegister,
  getDeath,
  releaseBody,
  deathPrint,
} from "../generated/body_release_ward";
import {
  evaluateBodyReleaseView,
  canReleaseBody,
  canViewBodyRegister,
  checkHandoverReadiness,
  validateBodyRelease,
  sortBodyReleaseQueue,
} from "../body-release-policy";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";

export interface BodyReleaseProps {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected?: boolean;
  stream?: string | null;
  timeZone?: string;
  onNavigateScreen?: (screen: string) => void;
  onBack?: () => void;
  screenId?: "body_release_ward" | "body_release_er";
}

export function BodyRelease({
  user,
  establishment,
  connected = true,
  stream,
  timeZone,
  onNavigateScreen,
  onBack,
  screenId = "body_release_ward",
}: BodyReleaseProps) {
  const tz = timeZone || "Asia/Karachi";

  // Service view capability evaluation (rule:20c304a0c8)
  const view = evaluateBodyReleaseView(establishment, screenId);
  const canRelease = canReleaseBody(user);
  const canView = canViewBodyRegister(user);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"pending" | "certified" | "draft" | "released" | "all">("pending");
  const [settingFilter, setSettingFilter] = useState<string>("all");

  // Selection states
  const [selectedDeathId, setSelectedDeathId] = useState<number | null>(null);
  const [activeDeathDetail, setActiveDeathDetail] = useState<DeathRecordOut | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Dialog states
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [releaseTargetDeath, setReleaseTargetDeath] = useState<DeathRegisterRowOut | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printPayload, setPrintPayload] = useState<PrintOut_DeathPrintFieldsOut_ | null>(null);
  const [isPrintLoading, setIsPrintLoading] = useState(false);

  // Form states for Body Handover
  const [releasedTo, setReleasedTo] = useState<"NextOfKin" | "Police" | "Mortuary" | "Other">("NextOfKin");
  const [receiverName, setReceiverName] = useState("");
  const [receiverRelationship, setReceiverRelationship] = useState("Spouse");
  const [receiverIdNumber, setReceiverIdNumber] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [policeReference, setPoliceReference] = useState("");
  const [releaseNote, setReleaseNote] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Clinical write helper
  const write = useClinicalWrite(user, screenId, () => {
    setShowReleaseModal(false);
    resetReleaseForm();
    reloadRegister();
  });

  // Load death register
  const {
    data: deaths,
    loading,
    error,
    reload: reloadRegister,
  } = useLoad<DeathRegisterRowOut[]>(
    async () => {
      const rows = await deathRegister({
        limit: 100,
        setting: settingFilter === "all" ? undefined : (settingFilter as any),
      });
      return sortBodyReleaseQueue(rows || []);
    },
    [settingFilter]
  );

  // Realtime event refresh on death.recorded (rule:realtime)
  useEffect(() => {
    if (stream?.includes("death.recorded") || stream?.includes("notification.created")) {
      reloadRegister();
    }
  }, [stream, reloadRegister]);

  // Load death details when selected
  useEffect(() => {
    if (!selectedDeathId) {
      setActiveDeathDetail(null);
      return;
    }
    let active = true;
    setIsDetailLoading(true);
    getDeath(selectedDeathId)
      .then((res) => {
        if (active) {
          setActiveDeathDetail(res.death);
          setIsDetailLoading(false);
        }
      })
      .catch(() => {
        if (active) setIsDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedDeathId]);

  function resetReleaseForm() {
    setReleasedTo("NextOfKin");
    setReceiverName("");
    setReceiverRelationship("Spouse");
    setReceiverIdNumber("");
    setReceiverPhone("");
    setPoliceReference("");
    setReleaseNote("");
    setFormErrors({});
    setReleaseTargetDeath(null);
  }

  function openReleaseModal(row: DeathRegisterRowOut) {
    const readiness = checkHandoverReadiness(row);
    if (!readiness.ready) return;

    setReleaseTargetDeath(row);
    const isMlc = Boolean(row.mlc_number);
    setReleasedTo(isMlc ? "Police" : "NextOfKin");
    setReceiverName("");
    setReceiverRelationship(isMlc ? "" : "Spouse");
    setReceiverIdNumber("");
    setReceiverPhone("");
    setPoliceReference(isMlc ? `MLC Intimation #${row.mlc_number}` : "");
    setReleaseNote("");
    setFormErrors({});
    setShowReleaseModal(true);
  }

  async function handlePrintCertificate(deathId: number) {
    setIsPrintLoading(true);
    setShowPrintModal(true);
    try {
      const payload = await deathPrint(deathId, { document: "certificate" });
      setPrintPayload(payload);
    } catch {
      setPrintPayload(null);
    } finally {
      setIsPrintLoading(false);
    }
  }

  function submitBodyRelease() {
    if (!releaseTargetDeath) return;

    const payload: BodyReleaseIn = {
      released_to: releasedTo,
      receiver_name: receiverName.trim(),
      receiver_relationship: releasedTo === "NextOfKin" ? receiverRelationship.trim() : null,
      receiver_id_number: releasedTo === "NextOfKin" ? receiverIdNumber.trim() : null,
      receiver_phone: receiverPhone.trim() || null,
      police_reference: releaseTargetDeath.mlc_number ? policeReference.trim() : null,
      note: releaseNote.trim() || null,
    };

    const errors = validateBodyRelease(payload, releaseTargetDeath);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    write.start({
      path: `/deaths/${releaseTargetDeath.death_id}/body-release`,
      method: "POST",
      body: payload,
      permission: "death.body.release",
      protection: "idempotent",
      label: t("Confirm Body Handover", "میت کی باضابطہ حوالگی کی تصدیق"),
    });
  }

  // Filtered queue
  const filteredDeaths = useMemo(() => {
    if (!deaths) return [];
    return deaths.filter((d) => {
      // Status filter
      if (statusFilter === "pending") {
        if (d.body_released_at) return false;
      } else if (statusFilter === "certified") {
        if (d.status !== "Certified" || d.body_released_at) return false;
      } else if (statusFilter === "draft") {
        if (d.status !== "Draft" || d.body_released_at) return false;
      } else if (statusFilter === "released") {
        if (!d.body_released_at) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesMrn = d.mrn?.toLowerCase().includes(q);
        const matchesName = d.patient_name?.toLowerCase().includes(q);
        const matchesNum = d.death_number?.toLowerCase().includes(q);
        const matchesMlc = d.mlc_number?.toLowerCase().includes(q);
        if (!matchesMrn && !matchesName && !matchesNum && !matchesMlc) return false;
      }

      return true;
    });
  }, [deaths, statusFilter, searchQuery]);

  // Status counters
  const counters = useMemo(() => {
    const total = deaths?.length || 0;
    const certifiedUnreleased = deaths?.filter((d) => d.status === "Certified" && !d.body_released_at).length || 0;
    const draftAwaiting = deaths?.filter((d) => d.status === "Draft" && !d.body_released_at).length || 0;
    const mlcCount = deaths?.filter((d) => Boolean(d.mlc_number) && !d.body_released_at).length || 0;
    const released = deaths?.filter((d) => Boolean(d.body_released_at)).length || 0;
    return { total, certifiedUnreleased, draftAwaiting, mlcCount, released };
  }, [deaths]);

  if (view.view === "hidden") {
    return (
      <div className="container p-4">
        <Empty>
          {t(
            "This body handover register is not enabled in facility services.",
            "یہ باڈی ہینڈ اوور رجسٹر ہسپتال سروسز میں فعال نہیں ہے۔"
          )}
        </Empty>
      </div>
    );
  }

  const isWard = screenId === "body_release_ward";
  const screenTitle = isWard
    ? t("Bodies awaiting handover (Ward)", "میت کی حوالگی کا رجسٹر (ان ڈور وارڈ)")
    : t("Bodies awaiting handover (ER)", "میت کی حوالگی کا رجسٹر (ایمرجنسی)");

  return (
    <div className="container-fluid py-3 px-3">
      {/* Top Header Card */}
      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-2 p-3">
          <div className="d-flex align-items-center gap-2">
            {onBack && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={onBack}
                data-help="body_release.btn_back"
              >
                ← {t("Back", "واپس")}
              </button>
            )}
            <h3 className="m-0 fw-bold">{screenTitle}</h3>
            <span className="badge bg-secondary">
              {isWard ? t("Inpatient Wards", "ان ڈور وارڈز") : t("Emergency Department", "ایمرجنسی ڈیپارٹمنٹ")}
            </span>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={() => reloadRegister()}
              data-help="body_release.btn_refresh"
            >
              🔄 {t("Refresh", "تازہ کریں")}
            </button>
          </div>
        </div>
      </div>

      {/* Service Banner */}
      {view.banner && (
        <div className="alert alert-warning py-2 mb-3" role="alert">
          ⚠️ {view.banner}
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm bg-success bg-opacity-10 text-success p-2">
            <div className="d-flex justify-content-between align-items-center">
              <span className="small fw-semibold">{t("Ready for Handover", "حوالگی کے لیے تیار")}</span>
              <span className="fs-4 fw-bold">{counters.certifiedUnreleased}</span>
            </div>
            <div className="small text-muted">{t("Certified by doctor", "ڈاکٹر سے تصدیق شدہ")}</div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm bg-warning bg-opacity-10 text-dark p-2">
            <div className="d-flex justify-content-between align-items-center">
              <span className="small fw-semibold">{t("Awaiting Certification", "ڈاکٹر تصدیق کا انتظار")}</span>
              <span className="fs-4 fw-bold">{counters.draftAwaiting}</span>
            </div>
            <div className="small text-muted">{t("Cannot leave ward (Draft)", "ڈرافٹ: وارڈ سے روانگی منع")}</div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm bg-danger bg-opacity-10 text-danger p-2">
            <div className="d-flex justify-content-between align-items-center">
              <span className="small fw-semibold">{t("Medico-Legal Cases", "میڈیکو لیگل اموات")}</span>
              <span className="fs-4 fw-bold">{counters.mlcCount}</span>
            </div>
            <div className="small text-muted">{t("Requires Police Diary Ref", "پولیس روزنامچہ حوالہ لازمی")}</div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm bg-secondary bg-opacity-10 text-secondary p-2">
            <div className="d-flex justify-content-between align-items-center">
              <span className="small fw-semibold">{t("Released Handover", "حوالہ شدہ")}</span>
              <span className="fs-4 fw-bold">{counters.released}</span>
            </div>
            <div className="small text-muted">{t("Dispatched to Kin / Police", "لواحقین یا پولیس کے حوالے")}</div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body p-2 d-flex flex-wrap gap-2 align-items-center justify-content-between">
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <div className="input-group input-group-sm" style={{ width: "260px" }}>
              <span className="input-group-text bg-white">🔍</span>
              <input
                type="text"
                className="form-control"
                placeholder={t("Search MRN, Name, Death #...", "ایم آر این، نام، ڈیتھ نمبر...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-help="body_release.search"
              />
            </div>

            <select
              className="form-select form-select-sm"
              style={{ width: "200px" }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              data-help="body_release.filter_status"
            >
              <option value="pending">{t("Pending Handover (All)", "زیرِ التواء تمام اموات")}</option>
              <option value="certified">{t("Certified (Ready to Release)", "تصدیق شدہ (حوالگی کے لیے تیار)")}</option>
              <option value="draft">{t("Draft (Doctor Not Certified)", "ڈرافٹ (ڈاکٹر تصدیق کا انتظار)")}</option>
              <option value="released">{t("Already Released", "پہلے سے حوالہ شدہ")}</option>
              <option value="all">{t("Show All Records", "تمام ریکارڈز دکھائیں")}</option>
            </select>

            <select
              className="form-select form-select-sm"
              style={{ width: "160px" }}
              value={settingFilter}
              onChange={(e) => setSettingFilter(e.target.value)}
              data-help="body_release.filter_setting"
            >
              <option value="all">{t("All Settings", "تمام شعبہ جات")}</option>
              <option value="Inpatient">{t("Inpatient Ward", "ان ڈور وارڈ")}</option>
              <option value="Emergency">{t("Emergency", "ایمرجنسی")}</option>
              <option value="BroughtDead">{t("Brought Dead", "مردہ لایا گیا")}</option>
              <option value="Outpatient">{t("Outpatient", "او پی ڈی")}</option>
            </select>
          </div>

          <div className="small text-muted">
            {t("Showing", "ظاہر کردہ")}: <strong>{filteredDeaths.length}</strong> {t("records", "اموات")}
          </div>
        </div>
      </div>

      {/* Main Table View */}
      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body p-0">
          <LoadState loading={loading} error={error} retry={reloadRegister} />

          {!loading && !error && filteredDeaths.length === 0 && (
            <div className="p-4">
              <Empty>
                {t("No deceased bodies found matching the filter criteria.", "فلٹر کے مطابق کوئی میت ریکارڈ نہیں ملا۔")}
              </Empty>
            </div>
          )}

          {!loading && !error && filteredDeaths.length > 0 && (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light small">
                  <tr>
                    <th>{t("Death #", "ڈیتھ نمبر")}</th>
                    <th>{t("Patient / MRN", "مریض / ایم آر این")}</th>
                    <th>{t("Setting / Ward", "شعبہ / وارڈ")}</th>
                    <th>{t("Time of Death", "وقتِ وفات")}</th>
                    <th>{t("Underlying Cause", "اصل سببِ وفات")}</th>
                    <th>{t("Certificate Status", "سرٹیفکیٹ اسٹیٹس")}</th>
                    <th>{t("Release Status", "حوالگی اسٹیٹس")}</th>
                    <th className="text-end">{t("Actions", "کارروائی")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeaths.map((d) => {
                    const isDraft = d.status === "Draft";
                    const isReleased = Boolean(d.body_released_at);
                    const isMlc = Boolean(d.mlc_number);
                    const canHandover = !isDraft && !isReleased && canRelease && view.canRelease;

                    return (
                      <tr
                        key={d.death_id}
                        className={isDraft ? "opacity-75 table-light" : isMlc ? "table-danger bg-opacity-10" : ""}
                      >
                        <td>
                          <span className="fw-bold">{d.death_number}</span>
                          {isMlc && (
                            <span className="badge bg-danger ms-1" title="Medico-Legal Case">
                              MLC #{d.mlc_number}
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="fw-bold">{d.patient_name || t("Unknown", "نامعلوم")}</div>
                          <div className="small text-muted">MRN: {d.mrn}</div>
                        </td>
                        <td>
                          <div>{d.setting}</div>
                          <div className="small text-muted">{d.ward_name || d.department_name || "-"}</div>
                        </td>
                        <td className="small">{d.death_at ? new Date(d.death_at).toLocaleString() : "-"}</td>
                        <td>
                          <div className="small text-truncate" style={{ maxWidth: "220px" }}>
                            {d.underlying_cause || <span className="text-muted italic">{t("Pending certification", "تصدیق باقی ہے")}</span>}
                          </div>
                          {d.underlying_icd && (
                            <span className="badge bg-info text-dark" style={{ fontSize: "0.7rem" }}>
                              {d.underlying_icd}
                            </span>
                          )}
                        </td>
                        <td>
                          {isDraft ? (
                            <span
                              className="badge bg-warning text-dark"
                              title={t("The doctor has not certified the cause of death yet (rule cd68894ad3)", "ڈاکٹر نے ابھی تک اسباب کی تصدیق نہیں کی")}
                            >
                              ⏳ {t("Draft (Pending Doctor)", "ڈرافٹ (ڈاکٹر تصدیق باقی)")}
                            </span>
                          ) : (
                            <span className="badge bg-success">
                              ✓ {t("Certified", "تصدیق شدہ")}
                            </span>
                          )}
                        </td>
                        <td>
                          {isReleased ? (
                            <div>
                              <span className="badge bg-secondary">
                                ✓ {t("Released", "حوالہ شدہ")}
                              </span>
                              <div className="small text-muted" style={{ fontSize: "0.75rem" }}>
                                {d.body_released_to} • {d.body_released_at ? new Date(d.body_released_at).toLocaleDateString() : ""}
                              </div>
                            </div>
                          ) : isDraft ? (
                            <span className="badge bg-light text-muted border">
                              🚫 {t("Cannot leave (Draft)", "روانگی منع (ڈرافٹ)")}
                            </span>
                          ) : (
                            <span className="badge bg-primary">
                              {t("Awaiting Handover", "حوالگی کے لیے تیار")}
                            </span>
                          )}
                        </td>
                        <td className="text-end">
                          <div className="btn-group btn-group-sm">
                            {/* Handover Body Button */}
                            {canHandover ? (
                              <button
                                type="button"
                                className="btn btn-success"
                                onClick={() => openReleaseModal(d)}
                                data-help="body_release.btn_open_release_modal"
                                title={t("Hand over body to Next of Kin or Police", "میت لواحقین یا پولیس کے حوالے کریں")}
                              >
                                🤝 {t("Hand Over Body", "میت حوالے کریں")}
                              </button>
                            ) : isDraft ? (
                              <button
                                type="button"
                                className="btn btn-outline-secondary disabled"
                                disabled
                                data-help="body_release.btn_open_release_modal"
                                title={t("Doctor must certify cause of death before body can leave the ward (rule cd68894ad3)", "میت کی روانگی سے قبل ڈاکٹر کی حتمی تصدیق لازمی ہے")}
                              >
                                ⏳ {t("Doctor Must Certify", "ڈاکٹر تصدیق کا انتظار")}
                              </button>
                            ) : null}

                            {/* View Details Button */}
                            <button
                              type="button"
                              className="btn btn-outline-primary"
                              onClick={() => setSelectedDeathId(d.death_id)}
                              data-help="body_release.btn_view_detail"
                            >
                              📋 {t("View", "دیکھیں")}
                            </button>

                            {/* Print Certificate Button */}
                            <button
                              type="button"
                              className="btn btn-outline-dark"
                              onClick={() => handlePrintCertificate(d.death_id)}
                              data-help="body_release.btn_print"
                              title={t("Print A4 Death Certificate & Handover Record", "سرکاری سرٹیفکیٹ اور حوالگی دستاویز پرنٹ کریں")}
                            >
                              🖨️ {t("Print", "پرنٹ")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Body Handover Dialog */}
      {showReleaseModal && releaseTargetDeath && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex={-1}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content shadow">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fw-bold">
                  🤝 {t("Deceased Patient Handover", "میت کی باضابطہ حوالگی")} - {releaseTargetDeath.death_number}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowReleaseModal(false)}
                  data-help="body_release.btn_close_release_modal"
                />
              </div>

              <div className="modal-body">
                {/* MLC Red Hazard Warning Banner */}
                {releaseTargetDeath.mlc_number && (
                  <div className="alert alert-danger mb-3 p-3" role="alert">
                    <div className="fw-bold fs-6">
                      ⚠️ {t("MEDICO-LEGAL DEATH HANDOVER", "میڈیکو لیگل کیس کی باضابطہ حوالگی")} (MLC #{releaseTargetDeath.mlc_number})
                    </div>
                    <div className="small">
                      {t(
                        "Under statutory rules, a medico-legal casualty cannot be released to next-of-kin without an official police letter or roznamcha daily diary dispatch number.",
                        "قانونی ضوابط کے تحت میڈیکو لیگل میت پولیس کے باضابطہ مراسلے یا روزنامچہ ڈائری نمبر کے بغیر حوالے نہیں کی جا سکتی۔"
                      )}
                    </div>
                  </div>
                )}

                {/* Patient Summary Card */}
                <div className="card bg-light border-0 mb-3 p-2">
                  <div className="row g-2">
                    <div className="col-sm-4">
                      <span className="text-muted small">{t("Patient Name", "مریض کا نام")}:</span>
                      <div className="fw-bold">{releaseTargetDeath.patient_name}</div>
                    </div>
                    <div className="col-sm-4">
                      <span className="text-muted small">{t("MRN", "ایم آر این")}:</span>
                      <div className="fw-bold">{releaseTargetDeath.mrn}</div>
                    </div>
                    <div className="col-sm-4">
                      <span className="text-muted small">{t("Setting / Ward", "شعبہ / وارڈ")}:</span>
                      <div>{releaseTargetDeath.setting} ({releaseTargetDeath.ward_name || "-"})</div>
                    </div>
                  </div>
                </div>

                {/* Feedback Banner */}
                <ClinicalWriteFeedback write={write} />

                {/* Handover Form */}
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">
                      {t("Release To Entity", "کس کے حوالے کیا جا رہا ہے")} *
                    </label>
                    <select
                      className="form-select"
                      value={releasedTo}
                      onChange={(e) => setReleasedTo(e.target.value as any)}
                      data-help="body_release.select_released_to"
                    >
                      <option value="NextOfKin">{t("Next of Kin / Family", "لواحقین / اہل خانہ")}</option>
                      <option value="Police">{t("Police Officer / Escort", "پولیس اہلکار / تحویل")}</option>
                      <option value="Mortuary">{t("Hospital Mortuary", "ہسپتال سرد خانہ")}</option>
                      <option value="Other">{t("Other Authorized Authority", "دیگر مجاز ادارہ")}</option>
                    </select>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-semibold">
                      {t("Receiver Full Name", "وصول کنندہ کا پورا نام")} *
                    </label>
                    <input
                      type="text"
                      className={`form-control ${formErrors.receiver_name ? "is-invalid" : ""}`}
                      placeholder={releasedTo === "Police" ? "e.g. ASI Muhammad Aslam (Belt #482)" : "e.g. Tariq Mehmood"}
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      data-help="body_release.input_receiver_name"
                    />
                    {formErrors.receiver_name && (
                      <div className="invalid-feedback">{formErrors.receiver_name}</div>
                    )}
                  </div>

                  {releasedTo === "NextOfKin" && (
                    <>
                      <div className="col-md-4">
                        <label className="form-label fw-semibold">
                          {t("Relationship to Deceased", "میت سے رشتہ")} *
                        </label>
                        <select
                          className={`form-select ${formErrors.receiver_relationship ? "is-invalid" : ""}`}
                          value={receiverRelationship}
                          onChange={(e) => setReceiverRelationship(e.target.value)}
                          data-help="body_release.select_receiver_relationship"
                        >
                          <option value="Spouse">{t("Spouse (Wife/Husband)", "شریک حیات (بیوی/شوہر)")}</option>
                          <option value="Son">{t("Son", "بیٹا")}</option>
                          <option value="Daughter">{t("Daughter", "بیٹی")}</option>
                          <option value="Father">{t("Father", "والد")}</option>
                          <option value="Mother">{t("Mother", "والدہ")}</option>
                          <option value="Brother">{t("Brother", "بھائی")}</option>
                          <option value="Sister">{t("Sister", "بہن")}</option>
                          <option value="Guardian">{t("Legal Guardian", "قانونی سرپرست")}</option>
                          <option value="Other">{t("Other Relative", "دیگر رشتہ دار")}</option>
                        </select>
                        {formErrors.receiver_relationship && (
                          <div className="invalid-feedback">{formErrors.receiver_relationship}</div>
                        )}
                      </div>

                      <div className="col-md-4">
                        <label className="form-label fw-semibold">
                          {t("Receiver CNIC / ID Number", "شناختی کارڈ نمبر")} *
                        </label>
                        <input
                          type="text"
                          className={`form-control ${formErrors.receiver_id_number ? "is-invalid" : ""}`}
                          placeholder="e.g. 35202-1234567-1"
                          value={receiverIdNumber}
                          onChange={(e) => setReceiverIdNumber(e.target.value)}
                          data-help="body_release.input_receiver_id_number"
                        />
                        {formErrors.receiver_id_number && (
                          <div className="invalid-feedback">{formErrors.receiver_id_number}</div>
                        )}
                      </div>

                      <div className="col-md-4">
                        <label className="form-label fw-semibold">
                          {t("Receiver Phone Number", "رابطہ نمبر")}
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. 0300-1234567"
                          value={receiverPhone}
                          onChange={(e) => setReceiverPhone(e.target.value)}
                          data-help="body_release.input_receiver_phone"
                        />
                      </div>
                    </>
                  )}

                  {releaseTargetDeath.mlc_number && (
                    <div className="col-12">
                      <label className="form-label fw-semibold text-danger">
                        {t("Police Dispatch Letter / Roznamcha Diary Ref", "پولیس ڈائری روزنامچہ / مراسلہ حوالہ نمبر")} *
                      </label>
                      <input
                        type="text"
                        className={`form-control border-danger ${formErrors.police_reference ? "is-invalid" : ""}`}
                        placeholder="e.g. Roznamcha Entry #42, Police Station Civil Lines"
                        value={policeReference}
                        onChange={(e) => setPoliceReference(e.target.value)}
                        data-help="body_release.input_police_reference"
                      />
                      {formErrors.police_reference && (
                        <div className="invalid-feedback">{formErrors.police_reference}</div>
                      )}
                    </div>
                  )}

                  <div className="col-12">
                    <label className="form-label fw-semibold">
                      {t("Handover Notes & Property Inventory", "حوالگی کے نوٹس اور سامان کی تفصیل")}
                    </label>
                    <textarea
                      className="form-control"
                      rows={2}
                      placeholder={t("Personal belongings, jewelry, or cash handed over with the body...", "میت کے ہمراہ دیے گئے ذاتی سامان یا نقدی وغیرہ کی تفصیل...")}
                      value={releaseNote}
                      onChange={(e) => setReleaseNote(e.target.value)}
                      data-help="body_release.input_release_note"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowReleaseModal(false)}
                  disabled={write.busy}
                  data-help="body_release.btn_cancel_release"
                >
                  {t("Cancel", "منسوخ")}
                </button>
                <button
                  type="button"
                  className="btn btn-success fw-bold"
                  onClick={submitBodyRelease}
                  disabled={write.busy}
                  data-help="body_release.btn_submit_release"
                >
                  {write.busy ? t("Recording Handover...", "حوالگی درج ہو رہی ہے...") : `✓ ${t("Confirm Handover & Release", "حوالگی کی تصدیق کریں")}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Death & Certificate Detail Drawer */}
      {selectedDeathId && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex={-1}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content shadow">
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title fw-bold">
                  📜 {t("Death & Cause of Death Record", "ڈیتھ ریکارڈ اور اسبابِ وفات")}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setSelectedDeathId(null)}
                  data-help="body_release.btn_close_detail_modal"
                />
              </div>

              <div className="modal-body">
                {isDetailLoading ? (
                  <div className="text-center p-4">
                    <div className="spinner-border text-primary" role="status" />
                    <div className="small text-muted mt-2">{t("Loading certificate...", "سرٹیفکیٹ لوڈ ہو رہا ہے...")}</div>
                  </div>
                ) : activeDeathDetail ? (
                  <div>
                    {activeDeathDetail.mlc_number && (
                      <div className="alert alert-danger py-2 mb-3">
                        ⚖️ <strong>{t("MEDICO-LEGAL CASE", "میڈیکو لیگل کیس")}:</strong> MLC #{activeDeathDetail.mlc_number}
                      </div>
                    )}

                    <div className="card bg-light p-3 border-0 mb-3">
                      <div className="row g-2">
                        <div className="col-sm-6">
                          <span className="small text-muted">{t("Certificate #", "سرٹیفکیٹ نمبر")}:</span>
                          <div className="fw-bold">{activeDeathDetail.death_number}</div>
                        </div>
                        <div className="col-sm-6">
                          <span className="small text-muted">{t("Time of Death", "وقتِ وفات")}:</span>
                          <div className="fw-bold">
                            {activeDeathDetail.death_at ? new Date(activeDeathDetail.death_at).toLocaleString() : "-"}
                          </div>
                        </div>
                        <div className="col-sm-6">
                          <span className="small text-muted">{t("Certifier PMDC Doctor", "تصدیق کنندہ ڈاکٹر")}:</span>
                          <div>{activeDeathDetail.pronounced_by_name || "-"}</div>
                        </div>
                        <div className="col-sm-6">
                          <span className="small text-muted">{t("Manner of Death", "طریقۂ وفات")}:</span>
                          <div>{activeDeathDetail.manner || "-"}</div>
                        </div>
                      </div>
                    </div>

                    <h6 className="fw-bold border-bottom pb-1">{t("WHO Part I: Cause of Death Chain", "ڈبلیو ایچ او حصہ اول: اسبابِ وفات")}</h6>
                    <ul className="list-group list-group-flush mb-3">
                      <li className="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                          <strong>(a) {t("Immediate Cause", "فوری سبب")}:</strong> {activeDeathDetail.cause_a || "-"}
                        </div>
                        <span className="badge bg-secondary">{activeDeathDetail.cause_a_interval || "-"}</span>
                      </li>
                      {activeDeathDetail.cause_b && (
                        <li className="list-group-item d-flex justify-content-between align-items-center">
                          <div>
                            <strong>(b) {t("Due to", "کی وجہ سے")}:</strong> {activeDeathDetail.cause_b}
                          </div>
                          <span className="badge bg-secondary">{activeDeathDetail.cause_b_interval || "-"}</span>
                        </li>
                      )}
                      {activeDeathDetail.cause_c && (
                        <li className="list-group-item d-flex justify-content-between align-items-center">
                          <div>
                            <strong>(c) {t("Due to", "کی وجہ سے")}:</strong> {activeDeathDetail.cause_c}
                          </div>
                          <span className="badge bg-secondary">{activeDeathDetail.cause_c_interval || "-"}</span>
                        </li>
                      )}
                      {activeDeathDetail.cause_d && (
                        <li className="list-group-item d-flex justify-content-between align-items-center">
                          <div>
                            <strong>(d) {t("Due to", "کی وجہ سے")}:</strong> {activeDeathDetail.cause_d}
                          </div>
                          <span className="badge bg-secondary">{activeDeathDetail.cause_d_interval || "-"}</span>
                        </li>
                      )}
                    </ul>

                    {activeDeathDetail.underlying_cause && (
                      <div className="alert alert-success py-2 mb-3">
                        🎯 <strong>{t("Underlying Cause of Death", "اصل بنیادی سببِ وفات")}:</strong> {activeDeathDetail.underlying_cause}
                        {activeDeathDetail.underlying_icd && ` (${activeDeathDetail.underlying_icd})`}
                      </div>
                    )}

                    {activeDeathDetail.body_released_at && (
                      <div className="card border-success p-2 mb-2 bg-success bg-opacity-10">
                        <div className="fw-bold text-success">✓ {t("Body Handover Record", "میت کی حوالگی کا باضابطہ ریکارڈ")}</div>
                        <div className="small">
                          {t("Released to", "حوالہ کیا گیا")}: <strong>{activeDeathDetail.body_released_to}</strong> ({activeDeathDetail.body_released_by_name || "-"})
                        </div>
                        <div className="small text-muted">
                          {t("Time", "وقت")}: {new Date(activeDeathDetail.body_released_at).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3">
                    <Empty>{t("Detail not found", "تفصیل دستیاب نہیں ہے")}</Empty>
                  </div>
                )}
              </div>

              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setSelectedDeathId(null)}
                  data-help="body_release.btn_footer_close_detail"
                >
                  {t("Close", "بند کریں")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: A4 Print Preview Modal */}
      {showPrintModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex={-1}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content shadow">
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title fw-bold">
                  🖨️ {t("Death Certificate & Handover Print Preview", "ڈیتھ سرٹیفکیٹ اور حوالگی رسید پیش منظر")}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowPrintModal(false)}
                  data-help="body_release.btn_close_print_modal"
                />
              </div>

              <div className="modal-body p-4 bg-light">
                {isPrintLoading ? (
                  <div className="text-center p-4">
                    <div className="spinner-border text-primary" role="status" />
                    <div className="small text-muted mt-2">{t("Loading print payload...", "پرنٹ ڈیٹا لوڈ ہو رہا ہے...")}</div>
                  </div>
                ) : printPayload ? (
                  <div className="bg-white p-4 shadow-sm border mx-auto" style={{ maxWidth: "700px", minHeight: "500px" }}>
                    {/* Official Letterhead */}
                    <div className="text-center border-bottom pb-3 mb-3">
                      <h4 className="fw-bold m-0">{printPayload.fields.hospital.name}</h4>
                      <div className="small text-muted">{printPayload.fields.hospital.address} • Ph: {printPayload.fields.hospital.phone}</div>
                      {printPayload.fields.hospital.phc_number && (
                        <div className="small text-secondary fw-semibold">PHC Reg: {printPayload.fields.hospital.phc_number}</div>
                      )}
                      <h5 className="fw-bold text-uppercase mt-2 mb-0">{t("Medical Certificate of Cause of Death & Body Handover", "موت کی تصدیق اور میت کی باضابطہ حوالگی نامہ")}</h5>
                      <div className="small text-muted">Cert. No: <strong>{printPayload.fields.certificate_number}</strong></div>
                    </div>

                    {/* Patient Particulars */}
                    <table className="table table-sm table-bordered mb-3 small">
                      <tbody>
                        <tr>
                          <td className="fw-bold bg-light" style={{ width: "25%" }}>Patient Name:</td>
                          <td>{printPayload.fields.patient.full_name}</td>
                          <td className="fw-bold bg-light" style={{ width: "25%" }}>MRN:</td>
                          <td>{printPayload.fields.patient.mrn}</td>
                        </tr>
                        <tr>
                          <td className="fw-bold bg-light">Age / Gender:</td>
                          <td>
                            {printPayload.fields.patient.age_at_death_years !== null ? `${printPayload.fields.patient.age_at_death_years} yrs` : "-"} / {printPayload.fields.patient.gender}
                          </td>
                          <td className="fw-bold bg-light">Setting:</td>
                          <td>{printPayload.fields.death.setting} ({printPayload.fields.death.ward_name || "-"})</td>
                        </tr>
                        <tr>
                          <td className="fw-bold bg-light">Date & Time of Death:</td>
                          <td colSpan={3}>{printPayload.fields.death.death_at ? new Date(printPayload.fields.death.death_at).toLocaleString() : "-"}</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* WHO Cause of Death */}
                    <div className="border p-2 mb-3 small">
                      <div className="fw-bold border-bottom pb-1 mb-2">WHO International Form: Cause of Death</div>
                      <div><strong>(a) Immediate cause:</strong> {printPayload.fields.death.cause_a} ({printPayload.fields.death.cause_a_interval || "-"})</div>
                      {printPayload.fields.death.cause_b && <div><strong>(b) Due to:</strong> {printPayload.fields.death.cause_b}</div>}
                      {printPayload.fields.death.underlying_cause && (
                        <div className="mt-2 text-success fw-bold">Underlying Cause: {printPayload.fields.death.underlying_cause}</div>
                      )}
                    </div>

                    {/* Handover Section (rule:15e617c197) */}
                    <div className="border p-2 mb-4 bg-light small">
                      <div className="fw-bold border-bottom pb-1 mb-2">{t("Body Handover & Receipt Declaration", "میت کی حوالگی اور وصولی کا اقرار نامہ")}</div>
                      <div>Receiver: <strong>{printPayload.fields.death.body_released_by_name || "Pending Release"}</strong></div>
                      <div>Recipient Entity: <strong>{printPayload.fields.death.body_released_to || "-"}</strong></div>
                      <div>Handover Timestamp: {printPayload.fields.death.body_released_at ? new Date(printPayload.fields.death.body_released_at).toLocaleString() : "-"}</div>
                    </div>

                    {/* Signatures */}
                    <div className="row text-center pt-4 small">
                      <div className="col-6">
                        <div className="border-top pt-2">
                          <strong>Receiver Signature & CNIC</strong>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="border-top pt-2">
                          <strong>Staff Nurse / Handover Officer</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3">
                    <Empty>{t("Print payload not available", "پرنٹ ڈیٹا دستیاب نہیں ہے")}</Empty>
                  </div>
                )}
              </div>

              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowPrintModal(false)}
                  data-help="body_release.btn_footer_close_print"
                >
                  {t("Close", "بند کریں")}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => window.print()}
                  data-help="body_release.btn_print_action"
                >
                  🖨️ {t("Print / Save PDF", "پرنٹ / پی ڈی ایف محفوظ کریں")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
