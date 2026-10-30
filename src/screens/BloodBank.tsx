import { useEffect, useState } from "react";
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
  BloodUnitOut,
  BloodUnitIn,
  BloodUnitTraceOut,
  BloodRequestOut,
  BloodRequestDetailOut,
  CrossmatchIn,
  BloodIssueIn,
  UnitDiscardIn,
  UnitReturnIn,
  ReturnIn,
  BloodStorageCheckIn,
  BloodStorageCheckOut,
  BloodSourceOut,
} from "../generated/blood_bank";
import {
  listUnits,
  receiveBloodUnits,
  discardBloodUnits,
  returnToSource,
  worklistBloodRequests,
  getRequest,
  crossmatch,
  issueBloodRequests,
  returnUnit,
  listChecks,
  recordCheckBloodStorageChecks,
  listSources,
} from "../generated/blood_bank";
import {
  bloodBankAccess,
  validateReceiveUnitIn,
  validateCrossmatchIn,
  validateBloodIssueIn,
  validateStorageCheckIn,
  isStorageTempOutOfRange,
  STORAGE_LIMITS,
  type BloodComponent,
  type BloodAbo,
  type BloodRh,
  type StorageKind,
  type UnitDiscardReason,
} from "../blood-bank-policy";
import { useClinicalWrite, ClinicalWriteFeedback } from "../clinical-write";

export function BloodBank({
  user,
  establishment,
  connected,
  stream,
}: {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected: boolean;
  stream: string;
}) {
  const view = establishment.views.screens.find(
    (s) => s.screen_id === "blood_bank",
  )?.view;
  const isServiceActive = Boolean(
    establishment.active && establishment.active.includes("blood_transfusion"),
  );
  const isServiceRetiring = view === "open_work";
  const access = bloodBankAccess(view, user.permissions, isServiceActive, isServiceRetiring);
  const live = connected && stream === "Live";

  const [revision, setRevision] = useState(0);
  const [activeTab, setActiveTab] = useState<"stock" | "receive" | "worklist" | "storage">("stock");
  const [error, setError] = useState<unknown>();
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);

  // Stock filters
  const [stockComponent, setStockComponent] = useState<string>("All");
  const [stockAbo, setStockAbo] = useState<string>("All");
  const [stockStatus, setStockStatus] = useState<string>("InStock");
  const [searchUnit, setSearchUnit] = useState<string>("");

  // Modals state
  const [discardUnitTarget, setDiscardUnitTarget] = useState<BloodUnitOut | null>(null);
  const [discardReason, setDiscardReason] = useState<UnitDiscardReason>("Expired");
  const [discardNote, setDiscardNote] = useState<string>("");

  const [returnSourceTarget, setReturnSourceTarget] = useState<BloodUnitOut | null>(null);
  const [returnSourceNote, setReturnSourceNote] = useState<string>("");

  const [selectedRequest, setSelectedRequest] = useState<BloodRequestDetailOut | null>(null);
  const [crossmatchModalOpen, setCrossmatchModalOpen] = useState(false);
  const [crossmatchUnitId, setCrossmatchUnitId] = useState<string>("");
  const [crossmatchAbo, setCrossmatchAbo] = useState<BloodAbo>("O");
  const [crossmatchRh, setCrossmatchRh] = useState<BloodRh>("Positive");
  const [crossmatchMethod, setCrossmatchMethod] = useState<string>("Gel Card");
  const [crossmatchResult, setCrossmatchResult] = useState<"Compatible" | "Incompatible">("Compatible");
  const [crossmatchNote, setCrossmatchNote] = useState<string>("");

  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [issueUnitId, setIssueUnitId] = useState<string>("");
  const [issueCrossmatchId, setIssueCrossmatchId] = useState<string>("");
  const [collectorUsername, setCollectorUsername] = useState<string>("");
  const [collectorPassword, setCollectorPassword] = useState<string>("");

  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnTransfusionId, setReturnTransfusionId] = useState<number | null>(null);
  const [returnFitForUse, setReturnFitForUse] = useState<boolean>(true);
  const [returnDiscardReason, setReturnDiscardReason] = useState<UnitDiscardReason>("OutOfStorageTooLong");
  const [returnNoteText, setReturnNoteText] = useState<string>("");

  // Receive Unit Form
  const [receiveSourceId, setReceiveSourceId] = useState<string>("");
  const [receiveUnitNumber, setReceiveUnitNumber] = useState<string>("");
  const [receiveComponent, setReceiveComponent] = useState<BloodComponent>("RedCells");
  const [receiveAbo, setReceiveAbo] = useState<BloodAbo>("O");
  const [receiveRh, setReceiveRh] = useState<BloodRh>("Positive");
  const [receiveVolume, setReceiveVolume] = useState<string>("450");
  const [receiveExpiry, setReceiveExpiry] = useState<string>("");
  const [receiveScreened, setReceiveScreened] = useState<boolean>(false);

  // Storage Check Form
  const [storageEquipment, setStorageEquipment] = useState<string>("Blood Refrigerator 1");
  const [storageKind, setStorageKind] = useState<StorageKind>("BloodRefrigerator");
  const [storageTemp, setStorageTemp] = useState<string>("4.0");
  const [storageAlarm, setStorageAlarm] = useState<boolean>(true);
  const [storageAction, setStorageAction] = useState<string>("");

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const write = useClinicalWrite(user, "blood_bank", () => {
    setDiscardUnitTarget(null);
    setReturnSourceTarget(null);
    setCrossmatchModalOpen(false);
    setIssueModalOpen(false);
    setReturnModalOpen(false);
    setValidationErrors({});
    setCollectorPassword("");
    setRevision((r) => r + 1);
  });

  // Load Blood Units (Stock)
  const unitsState = useLoad(
    () =>
      access.read
        ? listUnits({
            status: stockStatus === "All" ? undefined : (stockStatus as any),
            component: stockComponent === "All" ? undefined : (stockComponent as any),
            abo: stockAbo === "All" ? undefined : (stockAbo as any),
          })
        : Promise.resolve([]),
    [revision, stockStatus, stockComponent, stockAbo, access.read],
  );

  // Load Blood Sources
  const sourcesState = useLoad(
    () => (access.read ? listSources({ include_inactive: false }) : Promise.resolve([])),
    [revision, access.read],
  );

  // Load Blood Requests (Worklist)
  const requestsState = useLoad(
    () =>
      access.read
        ? worklistBloodRequests({ status: "Open" })
        : Promise.resolve([]),
    [revision, access.read],
  );

  // Load Storage Checks
  const checksState = useLoad(
    () => {
      if (!access.read) return Promise.resolve([]);
      const today = new Date().toISOString().slice(0, 10);
      return listChecks({ date_from: today, date_to: today });
    },
    [revision, access.read],
  );

  // Real-time Event Subscriptions
  useEffect(() => {
    const handleEvent = (event: Event) => {
      const custom = event as CustomEvent;
      const data = custom.detail;
      if (!data) return;
      const evType = data.event_type || data.type;

      if (evType === "blood.request.created") {
        setRealtimeNotice(t("New blood request received from doctor.", "ڈاکٹر کی جانب سے خون کی نئی درخواست موصول ہوئی۔"));
        setRevision((r) => r + 1);
      } else if (evType === "blood.consent.withdrawn") {
        setRealtimeNotice(t("CRITICAL: Patient transfusion consent was withdrawn!", "انتباہ: مریض کی انتقال خون کی باخبر رضامندی واپس لے لی گئی!"));
        setRevision((r) => r + 1);
      } else if (evType === "blood.storage.out_of_range") {
        setRealtimeNotice(t("ALERT: Blood storage temperature out of safe range!", "انتباہ: بلڈ بینک کا درجہ حرارت محفوظ حد سے باہر ہے!"));
        setRevision((r) => r + 1);
      } else if (evType === "blood.reaction.reported") {
        setRealtimeNotice(t("Adverse transfusion reaction reported from bedside ward.", "وارڈ سے خون کے منفی ردعمل کی رپورٹ درج ہوئی ہے۔"));
        setRevision((r) => r + 1);
      } else if (evType === "blood_center.component.released" || evType === "establishment.changed") {
        setRevision((r) => r + 1);
      }
    };

    window.addEventListener("haspataal:event", handleEvent);
    return () => window.removeEventListener("haspataal:event", handleEvent);
  }, []);

  const units = unitsState.data || [];
  const sources = sourcesState.data || [];
  const requests = requestsState.data || [];
  const storageChecks = checksState.data || [];

  // Sort stock: soonest expiry first (rule:cdfdb93c8e)
  const sortedUnits = [...units].sort((a, b) => {
    const tA = new Date(a.expires_at).getTime();
    const tB = new Date(b.expires_at).getTime();
    return tA - tB;
  });

  // Filter stock by search term
  const filteredUnits = sortedUnits.filter((u) => {
    if (!searchUnit.trim()) return true;
    const q = searchUnit.toLowerCase();
    return u.unit_number.toLowerCase().includes(q) || (u.donation_number && u.donation_number.toLowerCase().includes(q));
  });

  // Sort requests: Emergency first (rule:cdfdb93c8e)
  const sortedRequests = [...requests].sort((a, b) => {
    if (a.urgency === "Emergency" && b.urgency !== "Emergency") return -1;
    if (b.urgency === "Emergency" && a.urgency !== "Emergency") return 1;
    if (a.urgency === "Urgent" && b.urgency === "Routine") return -1;
    if (b.urgency === "Urgent" && a.urgency === "Routine") return 1;
    return b.request_id - a.request_id;
  });

  // Handle Receive Unit Submit
  const handleReceiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!access.receive || !live || write.busy) return;

    const validation = validateReceiveUnitIn({
      source_id: receiveSourceId ? Number(receiveSourceId) : null,
      unit_number: receiveUnitNumber,
      component: receiveComponent,
      abo: receiveAbo,
      rh: receiveRh,
      expires_at: receiveExpiry,
      screened: receiveScreened,
      volume_ml: receiveVolume ? Number(receiveVolume) : null,
    });

    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    const payload: BloodUnitIn = {
      source_id: Number(receiveSourceId),
      unit_number: receiveUnitNumber.trim(),
      component: receiveComponent,
      abo: receiveAbo,
      rh: receiveRh,
      expires_at: new Date(receiveExpiry).toISOString(),
      screened: true,
      volume_ml: receiveVolume ? Number(receiveVolume) : null,
    };

    write.start({
      method: "POST",
      path: "/blood/units",
      body: payload,
      permission: "blood.bank.operate",
      protection: "idempotent",
      reconcilePath: "/blood/units",
      label: t("Receive blood unit", "خون کا بیگ وصول کریں"),
    });
  };

  // Handle Discard Submit
  const handleDiscardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!discardUnitTarget || !access.discard || !live || write.busy) return;
    if (!discardNote.trim()) {
      setError(new Error(t("Please provide a discard disposal note.", "براہ کرم تلف کرنے کی وجہ اور تفصیل درج کریں۔")));
      return;
    }

    const payload: UnitDiscardIn = {
      reason: discardReason,
      note: discardNote.trim(),
    };

    write.start({
      method: "POST",
      path: `/blood/units/${discardUnitTarget.unit_id}/discard`,
      body: payload,
      permission: "blood.bank.operate",
      protection: "reconcile",
      reconcilePath: `/blood/units/${discardUnitTarget.unit_id}`,
      label: t("Discard blood unit", "خون کا بیگ تلف کریں"),
    });
  };

  // Handle Return to Source Submit
  const handleReturnSourceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnSourceTarget || !access.returnToSource || !live || write.busy) return;
    if (!returnSourceNote.trim()) {
      setError(new Error(t("Please provide a return note.", "واپسی کا نوٹ درج کریں۔")));
      return;
    }

    const payload: UnitReturnIn = {
      note: returnSourceNote.trim(),
    };

    write.start({
      method: "POST",
      path: `/blood/units/${returnSourceTarget.unit_id}/return-to-source`,
      body: payload,
      permission: "blood.bank.operate",
      protection: "reconcile",
      reconcilePath: `/blood/units/${returnSourceTarget.unit_id}`,
      label: t("Return unit to source", "خون کا بیگ بلڈ سنٹر واپس کریں"),
    });
  };

  // Handle Crossmatch Submit
  const handleCrossmatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !access.crossmatch || !live || write.busy) return;

    const validation = validateCrossmatchIn({
      unit_id: crossmatchUnitId ? Number(crossmatchUnitId) : null,
      patient_abo: crossmatchAbo,
      patient_rh: crossmatchRh,
      sample_taken_at: new Date().toISOString(),
      method: crossmatchMethod,
      result: crossmatchResult,
    });

    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    const payload: CrossmatchIn = {
      unit_id: Number(crossmatchUnitId),
      patient_abo: crossmatchAbo,
      patient_rh: crossmatchRh,
      sample_taken_at: new Date().toISOString(),
      method: crossmatchMethod.trim(),
      result: crossmatchResult,
      note: crossmatchNote.trim() || null,
    };

    write.start({
      method: "POST",
      path: `/blood/requests/${selectedRequest.request_id}/crossmatches`,
      body: payload,
      permission: "blood.bank.operate",
      protection: "idempotent",
      reconcilePath: `/blood/requests/${selectedRequest.request_id}`,
      label: t("Record compatibility test", "کراس میچ ٹیسٹ درج کریں"),
    });
  };

  // Handle Issue Submit
  const handleIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !access.issue || !live || write.busy) return;

    const validation = validateBloodIssueIn({
      unit_id: issueUnitId ? Number(issueUnitId) : null,
      collector_username: collectorUsername,
      collector_password: collectorPassword,
      crossmatch_id: issueCrossmatchId ? Number(issueCrossmatchId) : null,
      isEmergencyWithNote: Boolean(
        selectedRequest.urgency === "Emergency" && selectedRequest.uncrossmatched_note,
      ),
    });

    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    const payload: BloodIssueIn = {
      unit_id: Number(issueUnitId),
      crossmatch_id: issueCrossmatchId ? Number(issueCrossmatchId) : null,
      collector_username: collectorUsername.trim(),
      collector_password: collectorPassword,
    };

    write.start({
      method: "POST",
      path: `/blood/requests/${selectedRequest.request_id}/issue`,
      body: payload,
      permission: "blood.bank.operate",
      protection: "idempotent",
      reconcilePath: `/blood/requests/${selectedRequest.request_id}`,
      label: t("Issue blood unit", "خون جاری کریں"),
    });
  };

  // Handle Return Transfusion Submit
  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnTransfusionId || !access.returnUnit || !live || write.busy) return;

    const payload: ReturnIn = {
      fit_for_use: returnFitForUse,
      discard_reason: returnFitForUse ? null : returnDiscardReason,
      note: returnNoteText.trim() || null,
    };

    write.start({
      method: "POST",
      path: `/blood/transfusions/${returnTransfusionId}/return`,
      body: payload,
      permission: "blood.bank.operate",
      protection: "reconcile",
      reconcilePath: `/blood/requests`,
      label: t("Record returned unit", "واپس آنے والا خون درج کریں"),
    });
  };

  // Handle Storage Check Submit
  const handleStorageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!access.storageCheck || !live || write.busy) return;

    const validation = validateStorageCheckIn({
      equipment: storageEquipment,
      storage_kind: storageKind,
      temperature_c: storageTemp,
      action_taken: storageAction,
    });

    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    const payload: BloodStorageCheckIn = {
      equipment: storageEquipment.trim(),
      storage_kind: storageKind,
      temperature_c: Number(storageTemp),
      alarm_working: storageAlarm,
      action_taken: storageAction.trim() || null,
    };

    write.start({
      method: "POST",
      path: "/blood/storage-checks",
      body: payload,
      permission: "blood.bank.operate",
      protection: "idempotent",
      reconcilePath: "/blood/storage-checks",
      label: t("Log storage temperature", "درجہ حرارت کا اندراج"),
    });
  };

  return (
    <div className="container">
      <div className="bed-board-heading">
        <div>
          <h1>{t("Blood bank management", "بلڈ بینک اور خون کا انتظام")}</h1>
          <p>
            {t(
              "Receive units, stock expiries, requests worklist, crossmatch testing, issue to bedside, returns and discards, and cold-chain temperature logs.",
              "خون کے بیگز کی وصولی، اسٹاک کی میعاد، مطابقت ٹیسٹ، ترسیل، واپسی، تلفی اور کولڈ چین درجہ حرارت کا لاگ۔",
            )}
          </p>
        </div>
        <button
          data-help="blood_bank.refresh"
          onClick={() => setRevision((r) => r + 1)}
          disabled={unitsState.loading || requestsState.loading}
        >
          {t("Refresh blood bank", "بلڈ بینک تازہ کریں")}
        </button>
      </div>

      <ErrorBox error={error} />
      <ClinicalWriteFeedback write={write} onReviewed={() => setRevision((r) => r + 1)} />

      {realtimeNotice && (
        <div className="notice" style={{ borderColor: "red", color: "darkred" }}>
          <strong>{realtimeNotice}</strong>
          <button
            data-help="blood_bank.dialog_close"
            style={{ float: "right", padding: "0 0.5rem" }}
            onClick={() => setRealtimeNotice(null)}
          >
            ✕
          </button>
        </div>
      )}

      {!live && (
        <p className="notice">
          {t(
            "Connection is not live. Updates are paused.",
            "رابطہ تازہ نہیں ہے۔ اندراج وقتی طور پر معطل ہے۔",
          )}
        </p>
      )}

      {access.isRetiring && (
        <p className="notice">
          {t(
            "No new blood units from now on. Existing units and requests continue being fulfilled.",
            "اب نئے یونٹس نہیں؛ موجودہ اسٹاک اور درخواستوں کی ترسیل جاری رہے گی۔",
          )}
        </p>
      )}

      {access.isRecords && (
        <p className="notice">
          {t(
            "Records only: view blood bank stock history, testing logs, and temperature checks.",
            "صرف ریکارڈ: بلڈ بینک اسٹاک، ٹیسٹ اور کولڈ چین کے پرانے ریکارڈز۔",
          )}
        </p>
      )}

      {/* Navigation tabs */}
      <div className="card" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button
          data-help="blood_bank.tab_stock"
          className={activeTab === "stock" ? "primary" : ""}
          onClick={() => setActiveTab("stock")}
        >
          {t("Blood Stock & Shelves", "خون کا ذخیرہ (اسٹاک)")} ({units.length})
        </button>
        {access.receive && (
          <button
            data-help="blood_bank.tab_receive"
            className={activeTab === "receive" ? "primary" : ""}
            onClick={() => setActiveTab("receive")}
            disabled={!live || write.busy}
          >
            {t("Receive New Units", "نئے یونٹس وصول کریں")}
          </button>
        )}
        <button
          data-help="blood_bank.tab_worklist"
          className={activeTab === "worklist" ? "primary" : ""}
          onClick={() => setActiveTab("worklist")}
        >
          {t("Clinical Requests & Issue", "طبی درخواستیں اور ترسیل")} ({requests.length})
        </button>
        <button
          data-help="blood_bank.tab_storage"
          className={activeTab === "storage" ? "primary" : ""}
          onClick={() => setActiveTab("storage")}
        >
          {t("Storage Temperature Logs", "درجہ حرارت کا لاگ")}
        </button>
      </div>

      {/* TAB 1: BLOOD STOCK */}
      {activeTab === "stock" && (
        <div>
          {/* Filters */}
          <div className="card" style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
            <Field label={t("Component", "جزو")}>
              <select
                data-help="blood_bank.filter_component"
                value={stockComponent}
                onChange={(e) => setStockComponent(e.target.value)}
              >
                <option value="All">{t("All components", "تمام اجزاء")}</option>
                <option value="RedCells">{t("Red Cells (PRBC)", "سرخ خلیات")}</option>
                <option value="WholeBlood">{t("Whole Blood", "مکمل خون")}</option>
                <option value="FreshFrozenPlasma">{t("FFP", "پلازما")}</option>
                <option value="Platelets">{t("Platelets", "پلیٹلیٹس")}</option>
                <option value="Cryoprecipitate">{t("Cryoprecipitate", "کرائیو")}</option>
              </select>
            </Field>

            <Field label={t("ABO Group", "بلڈ گروپ")}>
              <select
                data-help="blood_bank.filter_abo"
                value={stockAbo}
                onChange={(e) => setStockAbo(e.target.value)}
              >
                <option value="All">{t("All groups", "تمام گروپس")}</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="AB">AB</option>
                <option value="O">O</option>
              </select>
            </Field>

            <Field label={t("Status", "کیفیت")}>
              <select
                data-help="blood_bank.filter_status"
                value={stockStatus}
                onChange={(e) => setStockStatus(e.target.value)}
              >
                <option value="InStock">{t("In Stock (Available)", "دستیاب اسٹاک")}</option>
                <option value="Reserved">{t("Reserved for crossmatch", "مخصوص شدہ")}</option>
                <option value="Issued">{t("Issued", "جاری شدہ")}</option>
                <option value="Transfused">{t("Transfused", "لگ چکا")}</option>
                <option value="Discarded">{t("Discarded", "تلف شدہ")}</option>
                <option value="ReturnedToSource">{t("Returned to Source", "واپس شدہ")}</option>
                <option value="All">{t("All statuses", "تمام کیفیتیں")}</option>
              </select>
            </Field>

            <Field label={t("Search bag #", "بیگ نمبر تلاش کریں")}>
              <input
                data-help="blood_bank.unit_search"
                type="search"
                value={searchUnit}
                onChange={(e) => setSearchUnit(e.target.value)}
                placeholder={t("Filter by unit # or donation #...", "یونٹ نمبر یا عطیہ نمبر سے فلٹر کریں...")}
              />
            </Field>
          </div>

          <LoadState loading={unitsState.loading} error={unitsState.error} retry={unitsState.reload} />

          {filteredUnits.length === 0 ? (
            <Empty>{t("No blood units found in stock.", "بلڈ بینک میں خون کا کوئی بیگ موجود نہیں ہے۔")}</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{t("Unit #", "بیگ نمبر")}</th>
                  <th>{t("Component", "جزو")}</th>
                  <th>{t("ABO / Rh", "بلڈ گروپ")}</th>
                  <th>{t("Source / Donation", "ذریعہ / عطیہ")}</th>
                  <th>{t("Expiry Date", "میعاد ختم ہونے کی تاریخ")}</th>
                  <th>{t("Status", "کیفیت")}</th>
                  <th>{t("Actions", "اقدامات")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUnits.map((u) => {
                  const isExpired = new Date(u.expires_at).getTime() < Date.now();
                  return (
                    <tr
                      key={u.unit_id}
                      style={{
                        backgroundColor: isExpired ? "#fff0f0" : undefined,
                      }}
                    >
                      <td>
                        <strong>{u.unit_number}</strong>
                        {u.volume_ml && <small> ({u.volume_ml} mL)</small>}
                      </td>
                      <td>{u.component}</td>
                      <td>
                        <strong>{u.abo} {u.rh}</strong>
                      </td>
                      <td>
                        {u.source_name || "—"}
                        {u.donation_number && (
                          <div style={{ fontSize: "0.8rem", color: "var(--muted, #666)" }}>
                            {t("Donation", "عطیہ")}: {u.donation_number}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ color: isExpired ? "red" : undefined, fontWeight: isExpired ? "bold" : "normal" }}>
                          {new Date(u.expires_at).toLocaleDateString()}
                        </span>
                        {isExpired && (
                          <span className="badge badge-danger" style={{ marginLeft: "0.5rem" }}>
                            {t("EXPIRED", "میعاد ختم")}
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            u.status === "InStock"
                              ? "badge-success"
                              : u.status === "Reserved"
                              ? "badge-warning"
                              : "badge-secondary"
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.25rem" }}>
                          {access.discard && (u.status === "InStock" || isExpired) && (
                            <button
                              data-help="blood_bank.discard_dialog"
                              className="danger"
                              onClick={() => {
                                setDiscardUnitTarget(u);
                                setDiscardReason(isExpired ? "Expired" : "BagDamaged");
                                setDiscardNote("");
                              }}
                              disabled={!live || write.busy}
                            >
                              {t("Discard", "تلف کریں")}
                            </button>
                          )}
                          {access.returnToSource && u.status === "InStock" && !isExpired && (
                            <button
                              data-help="blood_bank.return_source_dialog"
                              onClick={() => {
                                setReturnSourceTarget(u);
                                setReturnSourceNote("");
                              }}
                              disabled={!live || write.busy}
                            >
                              {t("Return to source", "واپس کریں")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB 2: RECEIVE NEW UNITS */}
      {activeTab === "receive" && (
        <div className="card" style={{ maxWidth: "700px" }}>
          <h3>{t("Receive external blood units", "بیرونی ذرائع سے خون کے بیگز کی وصولی")}</h3>
          <p>
            {t(
              "Type or scan the unit number as on the bag, component, ABO and Rh, and expiry. The screened box must be verified explicitly; an unscreened unit is refused (rule:82db038331).",
              "بیگ پر درج نمبر، جزو، بلڈ گروپ اور میعاد درج کریں۔ اسکریننگ کی تصدیق لازمی ہے (قانون: 82db038331)۔",
            )}
          </p>

          <form onSubmit={handleReceiveSubmit}>
            <Field label={t("Blood source / Regional Blood Center", "فراہم کنندہ بلڈ سنٹر")} hint={validationErrors.source_id}>
              <select
                data-help="blood_bank.receive_source"
                value={receiveSourceId}
                onChange={(e) => setReceiveSourceId(e.target.value)}
                required
              >
                <option value="">{t("-- Select licensed blood source --", "-- مجاز بلڈ سنٹر منتخب کریں --")}</option>
                {sources.map((s) => (
                  <option key={s.source_id} value={s.source_id}>
                    {s.name} ({s.kind} - {s.licence_number})
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t("Unit bag number (Barcode / Label)", "بیگ پر درج یونٹ نمبر")} hint={validationErrors.unit_number}>
              <input
                data-help="blood_bank.receive_number"
                type="text"
                value={receiveUnitNumber}
                onChange={(e) => setReceiveUnitNumber(e.target.value)}
                placeholder={t("e.g. PK-RBC-2026-9901", "مثلاً PK-RBC-2026-9901")}
                required
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
              <Field label={t("Component", "جزو")} hint={validationErrors.component}>
                <select
                  data-help="blood_bank.receive_component"
                  value={receiveComponent}
                  onChange={(e) => setReceiveComponent(e.target.value as BloodComponent)}
                  required
                >
                  <option value="RedCells">{t("Red Cells (PRBC)", "سرخ خلیات")}</option>
                  <option value="WholeBlood">{t("Whole Blood", "مکمل خون")}</option>
                  <option value="FreshFrozenPlasma">{t("FFP", "پلازما")}</option>
                  <option value="Platelets">{t("Platelets", "پلیٹلیٹس")}</option>
                  <option value="Cryoprecipitate">{t("Cryoprecipitate", "کرائیو")}</option>
                </select>
              </Field>

              <Field label={t("ABO Group", "بلڈ گروپ")} hint={validationErrors.abo}>
                <select
                  data-help="blood_bank.receive_abo"
                  value={receiveAbo}
                  onChange={(e) => setReceiveAbo(e.target.value as BloodAbo)}
                  required
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="AB">AB</option>
                  <option value="O">O</option>
                </select>
              </Field>

              <Field label={t("Rh Factor", "آر ایچ")} hint={validationErrors.rh}>
                <select
                  data-help="blood_bank.receive_rh"
                  value={receiveRh}
                  onChange={(e) => setReceiveRh(e.target.value as BloodRh)}
                  required
                >
                  <option value="Positive">{t("Positive (+)", "مثبت (+)")}</option>
                  <option value="Negative">{t("Negative (-)", "منفی (-)")}</option>
                </select>
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <Field label={t("Volume (mL)", "مقدار (ملی لیٹر)")}>
                <input
                  data-help="blood_bank.receive_volume"
                  type="number"
                  value={receiveVolume}
                  onChange={(e) => setReceiveVolume(e.target.value)}
                  placeholder="450"
                />
              </Field>

              <Field label={t("Expiry date on bag label", "میعاد ختم ہونے کی تاریخ")} hint={validationErrors.expires_at}>
                <input
                  data-help="blood_bank.receive_expiry"
                  type="date"
                  value={receiveExpiry}
                  onChange={(e) => setReceiveExpiry(e.target.value)}
                  required
                />
              </Field>
            </div>

            <div style={{ margin: "1rem 0" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "bold" }}>
                <input
                  data-help="blood_bank.receive_screened"
                  type="checkbox"
                  checked={receiveScreened}
                  onChange={(e) => setReceiveScreened(e.target.checked)}
                />
                {t(
                  "I verified this bag is screened negative for TTI (HIV, HBV, HCV, Syphilis, Malaria)",
                  "میں نے تصدیق کی کہ اس بیگ کی متعدی امراض کی اسکریننگ منفی ہے",
                )}
              </label>
              {validationErrors.screened && (
                <div style={{ color: "red", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                  {validationErrors.screened}
                </div>
              )}
            </div>

            <button
              data-help="blood_bank.receive_submit"
              className="primary"
              type="submit"
              disabled={write.busy || !live || !receiveScreened}
            >
              {t("Receive and add to stock", "بیگ وصول کر کے اسٹاک میں شامل کریں")}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: WORKLIST & CLINICAL REQUESTS */}
      {activeTab === "worklist" && (
        <div>
          <LoadState loading={requestsState.loading} error={requestsState.error} retry={requestsState.reload} />

          {sortedRequests.length === 0 ? (
            <Empty>{t("No pending blood requests.", "خون کی کوئی منتظر درخواست موجود نہیں ہے۔")}</Empty>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: selectedRequest ? "1.2fr 1fr" : "1fr", gap: "1rem" }}>
              <div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("Request #", "درخواست نمبر")}</th>
                      <th>{t("Patient / MRN", "مریض / ایم آر این")}</th>
                      <th>{t("Component", "جزو")}</th>
                      <th>{t("Issued / Req", "جاری / طلب")}</th>
                      <th>{t("Urgency", "فوری ضرورت")}</th>
                      <th>{t("Action", "عمل")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRequests.map((req) => (
                      <tr
                        key={req.request_id}
                        style={{
                          backgroundColor:
                            selectedRequest?.request_id === req.request_id
                              ? "var(--selection-bg, #f0f7ff)"
                              : req.urgency === "Emergency"
                              ? "#fff5f5"
                              : undefined,
                        }}
                      >
                        <td>
                          <strong>{req.request_number}</strong>
                        </td>
                        <td>
                          <div>{req.patient_name}</div>
                          <small>{req.mrn} {req.blood_group ? `(${req.blood_group})` : ""}</small>
                        </td>
                        <td>{req.component}</td>
                        <td>
                          <strong>{req.units_issued}</strong> / {req.units_requested}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              req.urgency === "Emergency"
                                ? "badge-danger"
                                : req.urgency === "Urgent"
                                ? "badge-warning"
                                : "badge-info"
                            }`}
                          >
                            {req.urgency}
                          </span>
                        </td>
                        <td>
                          <button
                            data-help="blood_bank.select_request"
                            onClick={async () => {
                              try {
                                const detail = await getRequest(req.request_id);
                                setSelectedRequest(detail);
                              } catch (e) {
                                setError(e);
                              }
                            }}
                          >
                            {t("Process request", "پروسیس کریں")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Selected Request Detail Drawer */}
              {selectedRequest && (
                <div className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3>{selectedRequest.request_number}</h3>
                    <button
                      data-help="blood_bank.dialog_close"
                      onClick={() => setSelectedRequest(null)}
                    >
                      {t("Close", "بند کریں")}
                    </button>
                  </div>

                  <p>
                    <strong>{selectedRequest.patient_name}</strong> ({selectedRequest.mrn}) •{" "}
                    <strong>{selectedRequest.component}</strong> ({selectedRequest.units_issued} / {selectedRequest.units_requested} {t("units issued", "جاری شدہ")})
                  </p>

                  <p>
                    <strong>{t("Urgency", "فوری ضرورت")}:</strong> {selectedRequest.urgency} •{" "}
                    <strong>{t("Indication", "طبی ضرورت")}:</strong> {selectedRequest.indication}
                  </p>

                  {selectedRequest.uncrossmatched_note && (
                    <div className="notice" style={{ borderColor: "red", color: "darkred" }}>
                      <strong>{t("Emergency Uncrossmatched Authorization Note", "ہنگامی بغیر کراس میچ نوٹ")}:</strong>
                      <p>{selectedRequest.uncrossmatched_note}</p>
                    </div>
                  )}

                  {/* Compatibility tests list */}
                  <div style={{ marginTop: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h4>{t("Crossmatch Compatibility Tests", "کراس میچ مطابقت ٹیسٹ")}</h4>
                      {access.crossmatch && (
                        <button
                          data-help="blood_bank.crossmatch_dialog"
                          onClick={() => {
                            setCrossmatchModalOpen(true);
                            setCrossmatchUnitId("");
                            setCrossmatchNote("");
                          }}
                          disabled={!live || write.busy}
                        >
                          {t("+ Record crossmatch", "+ کراس میچ درج کریں")}
                        </button>
                      )}
                    </div>

                    {selectedRequest.crossmatches?.length === 0 ? (
                      <p style={{ color: "var(--muted, #666)" }}>
                        {t("No compatibility test recorded yet.", "ابھی تک کوئی کراس میچ نہیں ہوا۔")}
                      </p>
                    ) : (
                      <ul style={{ paddingLeft: "1.2rem" }}>
                        {selectedRequest.crossmatches?.map((cm) => (
                          <li key={cm.crossmatch_id} style={{ margin: "0.25rem 0" }}>
                            Unit {cm.unit_number} ({cm.unit_abo} {cm.unit_rh}) →{" "}
                            <strong style={{ color: cm.result === "Compatible" ? "green" : "red" }}>
                              {cm.result}
                            </strong>{" "}
                            ({cm.method})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Transfusion / Issued units list */}
                  <div style={{ marginTop: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h4>{t("Issued Blood Units", "جاری شدہ بیگز")}</h4>
                      {access.issue && (
                        <button
                          data-help="blood_bank.issue_dialog"
                          className="primary"
                          onClick={() => {
                            setIssueModalOpen(true);
                            setIssueUnitId("");
                            setIssueCrossmatchId("");
                            setCollectorUsername("");
                            setCollectorPassword("");
                          }}
                          disabled={!live || write.busy}
                        >
                          {t("Issue unit to bedside", "بیڈ سائیڈ کے لیے خون جاری کریں")}
                        </button>
                      )}
                    </div>

                    {selectedRequest.transfusions?.length === 0 ? (
                      <p style={{ color: "var(--muted, #666)" }}>
                        {t("No units issued for this request yet.", "اس درخواست پر ابھی کوئی خون جاری نہیں ہوا۔")}
                      </p>
                    ) : (
                      <ul style={{ paddingLeft: "1.2rem" }}>
                        {selectedRequest.transfusions?.map((tr) => (
                          <li key={tr.transfusion_id} style={{ margin: "0.25rem 0" }}>
                            Unit <strong>{tr.unit_number}</strong>: {tr.status}
                            {tr.status === "Issued" && access.returnUnit && (
                              <button
                                data-help="blood_bank.return_unit_dialog"
                                style={{ marginLeft: "0.5rem", padding: "0.1rem 0.4rem", fontSize: "0.8rem" }}
                                onClick={() => {
                                  setReturnTransfusionId(tr.transfusion_id);
                                  setReturnFitForUse(true);
                                  setReturnModalOpen(true);
                                }}
                                disabled={!live || write.busy}
                              >
                                {t("Sign back / Return", "واپسی درج کریں")}
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: STORAGE TEMPERATURE LOGS */}
      {activeTab === "storage" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div className="card">
            <h3>{t("Log Storage Temperature Reading", "کولڈ چین درجہ حرارت درج کریں")}</h3>
            <p>
              {t(
                "Punjab Blood Transfusion Authority standards require twice-daily temperature logging. Out-of-range readings require documented corrective action (STORAGE_CHECK_ACTION_REQUIRED).",
                "پی بی ٹی اے کے تحت دن میں دو بار درجہ حرارت چیک کرنا لازمی ہے۔ حد سے تجاوز پر اصلاحی اقدام درج کرنا لازمی ہے۔",
              )}
            </p>

            <form onSubmit={handleStorageSubmit}>
              <Field label={t("Equipment identifier", "آلات / ریفریجریٹر کا نام")} hint={validationErrors.equipment}>
                <input
                  data-help="blood_bank.storage_equipment"
                  type="text"
                  value={storageEquipment}
                  onChange={(e) => setStorageEquipment(e.target.value)}
                  placeholder="Blood Refrigerator 1"
                  required
                />
              </Field>

              <Field label={t("Storage equipment kind", "اسٹوریج آلات کی قسم")}>
                <select
                  data-help="blood_bank.storage_kind"
                  value={storageKind}
                  onChange={(e) => {
                    const k = e.target.value as StorageKind;
                    setStorageKind(k);
                    setStorageTemp(k === "BloodRefrigerator" ? "4.0" : k === "PlasmaFreezer" ? "-30.0" : "22.0");
                  }}
                  required
                >
                  <option value="BloodRefrigerator">{STORAGE_LIMITS.BloodRefrigerator.labelEn}</option>
                  <option value="PlasmaFreezer">{STORAGE_LIMITS.PlasmaFreezer.labelEn}</option>
                  <option value="PlateletIncubator">{STORAGE_LIMITS.PlateletIncubator.labelEn}</option>
                </select>
              </Field>

              <Field label={t("Temperature (°C)", "درجہ حرارت (سینٹی گریڈ)")} hint={validationErrors.temperature_c}>
                <input
                  data-help="blood_bank.storage_temp"
                  type="number"
                  step="0.1"
                  value={storageTemp}
                  onChange={(e) => setStorageTemp(e.target.value)}
                  required
                />
              </Field>

              <div style={{ margin: "0.75rem 0" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    data-help="blood_bank.storage_alarm"
                    type="checkbox"
                    checked={storageAlarm}
                    onChange={(e) => setStorageAlarm(e.target.checked)}
                  />
                  {t("Alarm system tested and operational", "الارم سسٹم ٹیسٹ شدہ اور درست کام کر رہا ہے")}
                </label>
              </div>

              {isStorageTempOutOfRange(storageKind, Number(storageTemp)).outOfRange && (
                <div className="notice" style={{ borderColor: "red", color: "darkred" }}>
                  <strong>{t("TEMPERATURE OUT OF SAFE RANGE!", "انتباہ: درجہ حرارت محفوظ حد سے باہر ہے!")}</strong>
                  <Field label={t("Corrective action taken", "کی گئی اصلاحی کارروائی")} hint={validationErrors.action_taken}>
                    <textarea
                      data-help="blood_bank.storage_action"
                      rows={2}
                      value={storageAction}
                      onChange={(e) => setStorageAction(e.target.value)}
                      placeholder={t("e.g. Switched to backup generator, transferred units to backup fridge...", "مثلاً بیک اپ ریفریجریٹر میں منتقل کیا گیا...")}
                      required
                    />
                  </Field>
                </div>
              )}

              <button
                data-help="blood_bank.storage_submit"
                className="primary"
                type="submit"
                disabled={write.busy || !live}
              >
                {t("Log temperature check", "درجہ حرارت محفوظ کریں")}
              </button>
            </form>
          </div>

          <div>
            <div className="card">
              <h3>{t("Today's Temperature Log", "آج کے درجہ حرارت کا لاگ")}</h3>
              <LoadState loading={checksState.loading} error={checksState.error} retry={checksState.reload} />

              {storageChecks.length === 0 ? (
                <Empty>{t("No temperature checks recorded today.", "آج کا کوئی لاگ درج نہیں ہے۔")}</Empty>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("Time", "وقت")}</th>
                      <th>{t("Equipment", "آلہ")}</th>
                      <th>{t("Temp (°C)", "درجہ حرارت")}</th>
                      <th>{t("Alarm", "الارم")}</th>
                      <th>{t("Action", "کارروائی")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storageChecks.map((sc) => (
                      <tr
                        key={sc.check_id}
                        style={{
                          backgroundColor: !sc.within_range ? "#fff0f0" : undefined,
                        }}
                      >
                        <td>{new Date(sc.recorded_at).toLocaleTimeString()}</td>
                        <td>{sc.equipment}</td>
                        <td>
                          <strong>{sc.temperature_c}°C</strong>
                          {!sc.within_range && (
                            <span className="badge badge-danger" style={{ marginLeft: "0.25rem" }}>
                              {t("ALERT", "انتباہ")}
                            </span>
                          )}
                        </td>
                        <td>{sc.alarm_working ? "✓" : "✗"}</td>
                        <td>{sc.action_taken || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DISCARD UNIT */}
      {discardUnitTarget && (
        <Modal
          title={t("Discard blood unit", "خون کا بیگ تلف کریں")}
          onClose={() => setDiscardUnitTarget(null)}
        >
          <form onSubmit={handleDiscardSubmit}>
            <p>
              {t("Discarding unit #", "بیگ نمبر تلف کیا جا رہا ہے: ")}
              <strong>{discardUnitTarget.unit_number}</strong> ({discardUnitTarget.component}, {discardUnitTarget.abo} {discardUnitTarget.rh})
            </p>

            <Field label={t("Discard reason", "تلف کرنے کی وجہ")}>
              <select
                data-help="blood_bank.discard_reason"
                value={discardReason}
                onChange={(e) => setDiscardReason(e.target.value as UnitDiscardReason)}
                required
              >
                <option value="Expired">{t("Expired", "میعاد ختم")}</option>
                <option value="BagDamaged">{t("Bag Damaged / Leakage", "بیگ خراب یا لیک")}</option>
                <option value="OutOfStorageTooLong">{t("Out of storage too long (>30 min)", "زیادہ دیر باہر رہا")}</option>
                <option value="StorageTemperature">{t("Storage temperature excursion", "درجہ حرارت کی خرابی")}</option>
                <option value="IdentityDiscrepancy">{t("Identity discrepancy", "شناخت کا فرق")}</option>
                <option value="Other">{t("Other clinical reason", "دیگر وجہ")}</option>
              </select>
            </Field>

            <Field label={t("Disposal destination and notes", "تلفی کی تفصیل اور طریقہ کار")}>
              <textarea
                data-help="blood_bank.discard_note"
                rows={2}
                value={discardNote}
                onChange={(e) => setDiscardNote(e.target.value)}
                placeholder={t("Document incineration or biological waste bin ID...", "بائیو ویسٹ یا جلانے کا اندراج...")}
                required
              />
            </Field>

            <div className="modal-actions">
              <button
                type="submit"
                data-help="blood_bank.discard_submit"
                className="danger"
                disabled={write.busy || !live}
              >
                {t("Confirm discard", "تلفی کی تصدیق")}
              </button>
              <button
                type="button"
                data-help="blood_bank.dialog_close"
                onClick={() => setDiscardUnitTarget(null)}
              >
                {t("Cancel", "منسوخ")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: RETURN TO SOURCE */}
      {returnSourceTarget && (
        <Modal
          title={t("Return blood unit to source center", "خون کا بیگ بلڈ سنٹر واپس کریں")}
          onClose={() => setReturnSourceTarget(null)}
        >
          <form onSubmit={handleReturnSourceSubmit}>
            <p>
              {t("Returning unit #", "واپس کیا جا رہا ہے: ")}
              <strong>{returnSourceTarget.unit_number}</strong> ({returnSourceTarget.source_name})
            </p>

            <Field label={t("Return reason and cold-chain note", "واپسی کی وجہ اور کولڈ چین تفصیل")}>
              <textarea
                data-help="blood_bank.return_source_note"
                rows={2}
                value={returnSourceNote}
                onChange={(e) => setReturnSourceNote(e.target.value)}
                placeholder={t("Document carrier, ice-box transport, and authorization...", "کولڈ چین ٹرانسپورٹ اور اجازت نامہ...")}
                required
              />
            </Field>

            <div className="modal-actions">
              <button
                type="submit"
                data-help="blood_bank.return_source_submit"
                disabled={write.busy || !live}
              >
                {t("Confirm return to source", "واپسی کی تصدیق")}
              </button>
              <button
                type="button"
                data-help="blood_bank.dialog_close"
                onClick={() => setReturnSourceTarget(null)}
              >
                {t("Cancel", "منسوخ")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: RECORD CROSSMATCH */}
      {crossmatchModalOpen && selectedRequest && (
        <Modal
          title={t("Record compatibility test (Crossmatch)", "کراس میچ مطابقت ٹیسٹ درج کریں")}
          onClose={() => setCrossmatchModalOpen(false)}
        >
          <form onSubmit={handleCrossmatchSubmit}>
            <p>
              {t("Request for", "برائے مریض: ")}
              <strong>{selectedRequest.patient_name}</strong> ({selectedRequest.mrn}) • {selectedRequest.component}
            </p>

            <Field label={t("Select in-stock unit", "دستیاب خون کا بیگ منتخب کریں")} hint={validationErrors.unit_id}>
              <select
                data-help="blood_bank.crossmatch_unit"
                value={crossmatchUnitId}
                onChange={(e) => setCrossmatchUnitId(e.target.value)}
                required
              >
                <option value="">{t("-- Select blood unit --", "-- بیگ منتخب کریں --")}</option>
                {units
                  .filter((u) => u.status === "InStock" && u.component === selectedRequest.component)
                  .map((u) => (
                    <option key={u.unit_id} value={u.unit_id}>
                      Unit {u.unit_number} ({u.abo} {u.rh}) — Exp: {new Date(u.expires_at).toLocaleDateString()}
                    </option>
                  ))}
              </select>
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <Field label={t("Patient ABO", "مریض کا اے بی او")}>
                <select
                  data-help="blood_bank.crossmatch_abo"
                  value={crossmatchAbo}
                  onChange={(e) => setCrossmatchAbo(e.target.value as BloodAbo)}
                  required
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="AB">AB</option>
                  <option value="O">O</option>
                </select>
              </Field>

              <Field label={t("Patient Rh", "مریض کا آر ایچ")}>
                <select
                  data-help="blood_bank.crossmatch_rh"
                  value={crossmatchRh}
                  onChange={(e) => setCrossmatchRh(e.target.value as BloodRh)}
                  required
                >
                  <option value="Positive">{t("Positive (+)", "مثبت (+)")}</option>
                  <option value="Negative">{t("Negative (-)", "منفی (-)")}</option>
                </select>
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <Field label={t("Method / Technique", "ٹیسٹنگ طریقہ کار")}>
                <input
                  data-help="blood_bank.crossmatch_method"
                  type="text"
                  value={crossmatchMethod}
                  onChange={(e) => setCrossmatchMethod(e.target.value)}
                  placeholder="Gel Card / Tube AHG"
                  required
                />
              </Field>

              <Field label={t("Test Result", "نتیجہ")}>
                <select
                  data-help="blood_bank.crossmatch_result"
                  value={crossmatchResult}
                  onChange={(e) => setCrossmatchResult(e.target.value as any)}
                  required
                >
                  <option value="Compatible">{t("Compatible (Reserves unit)", "مطابقت درست (مخصوص کیا جائے)")}</option>
                  <option value="Incompatible">{t("Incompatible", "مطابقت غیر درست")}</option>
                </select>
              </Field>
            </div>

            <Field label={t("Laboratory testing notes", "لیبارٹری نوٹس")}>
              <textarea
                data-help="blood_bank.crossmatch_note"
                rows={2}
                value={crossmatchNote}
                onChange={(e) => setCrossmatchNote(e.target.value)}
                placeholder={t("Major / Minor crossmatch observations...", "کراس میچ مشاہدات...")}
              />
            </Field>

            <div className="modal-actions">
              <button
                type="submit"
                data-help="blood_bank.crossmatch_submit"
                disabled={write.busy || !live || !crossmatchUnitId}
              >
                {t("Save compatibility test", "ٹیسٹ محفوظ کریں")}
              </button>
              <button
                type="button"
                data-help="blood_bank.dialog_close"
                onClick={() => setCrossmatchModalOpen(false)}
              >
                {t("Cancel", "منسوخ")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: ISSUE UNIT */}
      {issueModalOpen && selectedRequest && (
        <Modal
          title={t("Issue blood unit to bedside staff", "وارڈ کے عملے کو خون جاری کریں")}
          onClose={() => setIssueModalOpen(false)}
        >
          <form onSubmit={handleIssueSubmit}>
            <p>
              {t("Issuing for", "برائے: ")}
              <strong>{selectedRequest.patient_name}</strong> ({selectedRequest.mrn})
            </p>

            <Field label={t("Select reserved unit", "مخصوص شدہ بیگ منتخب کریں")} hint={validationErrors.unit_id}>
              <select
                data-help="blood_bank.issue_dialog"
                value={issueUnitId}
                onChange={(e) => {
                  setIssueUnitId(e.target.value);
                  const cm = selectedRequest.crossmatches?.find((c) => String(c.unit_id) === e.target.value && c.result === "Compatible");
                  if (cm) setIssueCrossmatchId(String(cm.crossmatch_id));
                }}
                required
              >
                <option value="">{t("-- Select unit to issue --", "-- بیگ منتخب کریں --")}</option>
                {units
                  .filter((u) => u.status === "Reserved" || (selectedRequest.urgency === "Emergency" && u.status === "InStock"))
                  .map((u) => (
                    <option key={u.unit_id} value={u.unit_id}>
                      Unit {u.unit_number} ({u.component}, {u.abo} {u.rh}) — {u.status}
                    </option>
                  ))}
              </select>
            </Field>

            <div className="notice" style={{ borderColor: "#2563eb", background: "#f8faff" }}>
              <strong>{t("Collector Sign-in Verification (STEP_UP_REQUIRED)", "وصول کنندہ عملے کا باضابطہ دستخط")}</strong>
              <p style={{ fontSize: "0.85rem", margin: "0.25rem 0" }}>
                {t(
                  "The registered nurse or doctor taking the blood unit to the ward signs for it with their own credentials (rule:7378206488).",
                  "خون وصول کرنے والی نرس یا ڈاکٹر اپنے لاگ ان سے دستخط کر کے بیگ وصول کرتے ہیں۔",
                )}
              </p>

              <Field label={t("Collector staff username", "وصول کنندہ کا یوزر نام")} hint={validationErrors.collector_username}>
                <input
                  data-help="blood_bank.issue_collector_user"
                  type="text"
                  value={collectorUsername}
                  onChange={(e) => setCollectorUsername(e.target.value)}
                  placeholder="e.g. demo.nurse"
                  required
                />
              </Field>

              <Field label={t("Collector staff password", "وصول کنندہ کا پاس ورڈ")} hint={validationErrors.collector_password}>
                <input
                  data-help="blood_bank.issue_collector_pass"
                  type="password"
                  value={collectorPassword}
                  onChange={(e) => setCollectorPassword(e.target.value)}
                  required
                />
              </Field>
            </div>

            <div className="modal-actions">
              <button
                type="submit"
                data-help="blood_bank.issue_submit"
                className="primary"
                disabled={write.busy || !live || !issueUnitId || !collectorUsername || !collectorPassword}
              >
                {t("Sign and issue blood", "دستخط کر کے خون جاری کریں")}
              </button>
              <button
                type="button"
                data-help="blood_bank.dialog_close"
                onClick={() => setIssueModalOpen(false)}
              >
                {t("Cancel", "منسوخ")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: RETURN TRANSFUSION UNIT */}
      {returnModalOpen && returnTransfusionId && (
        <Modal
          title={t("Record returned blood unit", "واپس آنے والا خون کا بیگ درج کریں")}
          onClose={() => setReturnModalOpen(false)}
        >
          <form onSubmit={handleReturnSubmit}>
            <p>
              {t(
                "A unit coming back within 30 minutes of issue can be returned to stock; otherwise it must be marked Not given and discarded (rule:0e8d0a52ed).",
                "30 منٹ کے اندر واپس آنے والا خون اسٹاک میں واپس آ سکتا ہے، ورنہ تلف کیا جاتا ہے۔",
              )}
            </p>

            <div style={{ margin: "1rem 0" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "bold" }}>
                <input
                  data-help="blood_bank.return_fit_checkbox"
                  type="checkbox"
                  checked={returnFitForUse}
                  onChange={(e) => setReturnFitForUse(e.target.checked)}
                />
                {t("Signed back in time (Within 30 minutes, cold chain intact)", "30 منٹ کے اندر واپس موصول (کولڈ چین برقرار)")}
              </label>
            </div>

            {!returnFitForUse && (
              <div>
                <Field label={t("Discard / Unused reason", "ناقابل استعمال رہنے کی وجہ")}>
                  <select
                    data-help="blood_bank.return_reason"
                    value={returnDiscardReason}
                    onChange={(e) => setReturnDiscardReason(e.target.value as UnitDiscardReason)}
                    required
                  >
                    <option value="OutOfStorageTooLong">{t("Out of storage too long (>30 min)", "زیادہ دیر باہر رہا")}</option>
                    <option value="BagDamaged">{t("Bag Damaged / Port Tampered", "بیگ کو نقصان پہنچا")}</option>
                    <option value="IdentityDiscrepancy">{t("Bedside identity discrepancy", "شناخت کا فرق")}</option>
                    <option value="Other">{t("Other clinical reason", "دیگر طبی وجہ")}</option>
                  </select>
                </Field>

                <Field label={t("Clinical explanation note", "طبی وضاحت")}>
                  <textarea
                    data-help="blood_bank.return_note"
                    rows={2}
                    value={returnNoteText}
                    onChange={(e) => setReturnNoteText(e.target.value)}
                    placeholder={t("Why was the unit not given to the patient...", "مریض کو نہ لگنے کی تفصیل...")}
                    required
                  />
                </Field>
              </div>
            )}

            <div className="modal-actions">
              <button
                type="submit"
                data-help="blood_bank.return_submit"
                disabled={write.busy || !live}
              >
                {t("Confirm unit return", "واپسی درج کریں")}
              </button>
              <button
                type="button"
                data-help="blood_bank.dialog_close"
                onClick={() => setReturnModalOpen(false)}
              >
                {t("Cancel", "منسوخ")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
