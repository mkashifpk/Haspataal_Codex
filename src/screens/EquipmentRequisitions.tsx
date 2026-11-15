import { useState } from "react";
import { bilingual as t } from "../i18n";
import { ClinicalUser } from "../clinical-context";
import { ErrorBox, LoadState, useLoad } from "../components";
import {
  listRequisitionsFacilityEquipment,
  getRequisitionFacilityEquipmentRequisitions,
  createRequisitionFacilityEquipmentRequisitions,
  addOption,
  evaluate,
  decide,
  markPurchased,
  cancelFacilityEquipmentRequisitions,
  vendors as listVendors,
  listEquipment,
  departments as listDepartments,
  listCommittees,
  EquipmentRequisitionOut,
  EquipmentRequisitionDetailOut,
  DepartmentOut,
  VendorOut,
  EquipmentOut,
  CommitteeOut,
} from "../generated/equipment_requisitions";

type Props = {
  revision: number;
  user: ClinicalUser;
  onOpenHelp: () => void;
  connected: boolean;
};

const statusColors: Record<string, string> = {
  Open: "info",
  Evaluating: "warning",
  Decided: "primary",
  Purchased: "success",
  Cancelled: "secondary",
};

export function EquipmentRequisitions({ revision, user, onOpenHelp, connected }: Props) {
  // Requisitions list
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const requisitions = useLoad<EquipmentRequisitionOut[]>(
    () =>
      listRequisitionsFacilityEquipment({
        status: statusFilter ? (statusFilter as any) : undefined,
      }),
    [revision, statusFilter]
  );

  // Aux reference data
  const depts = useLoad(() => listDepartments(), [revision]);
  const vendorList = useLoad(() => listVendors({ vendor_type: "EquipmentSupplier" }), [revision]);
  const equipList = useLoad(() => listEquipment({ include_disposed: false }), [revision]);
  const committees = useLoad(() => listCommittees({ active_only: true }), [revision]);

  // Selected requisition detail
  const [selectedReq, setSelectedReq] = useState<EquipmentRequisitionOut | null>(null);
  const [reqDetail, setReqDetail] = useState<EquipmentRequisitionDetailOut | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<unknown>();

  // Modals & sub-action forms
  const [showNewModal, setShowNewModal] = useState(false);
  const [showAddOptionModal, setShowAddOptionModal] = useState(false);
  const [evaluatingOptionId, setEvaluatingOptionId] = useState<number | null>(null);
  const [showDecideModal, setShowDecideModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Form states: New Requisition
  const [newDeptId, setNewDeptId] = useState<string>("");
  const [newTitle, setNewTitle] = useState("");
  const [newSpec, setNewSpec] = useState("");
  const [newJust, setNewJust] = useState("");
  const [newQty, setNewQty] = useState(1);
  const [newCost, setNewCost] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const [newError, setNewError] = useState<unknown>();

  // Form states: Add Option
  const [optModel, setOptModel] = useState("");
  const [optVendorId, setOptVendorId] = useState<string>("");
  const [optPrice, setOptPrice] = useState("");
  const [optDetails, setOptDetails] = useState("");
  const [savingOpt, setSavingOpt] = useState(false);
  const [optError, setOptError] = useState<unknown>();

  // Form states: Evaluate Option
  const [evalScore, setEvalScore] = useState<number>(5);
  const [evalRemarks, setEvalRemarks] = useState("");
  const [savingEval, setSavingEval] = useState(false);
  const [evalError, setEvalError] = useState<unknown>();

  // Form states: Decide (rule:28f12beb07)
  const [decideOptionId, setDecideOptionId] = useState<string>("");
  const [decideNote, setDecideNote] = useState("");
  const [decideMeetingId, setDecideMeetingId] = useState<string>("");
  const [savingDecide, setSavingDecide] = useState(false);
  const [decideError, setDecideError] = useState<unknown>();

  // Form states: Purchased
  const [purchaseAssetId, setPurchaseAssetId] = useState<string>("");
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [purchaseError, setPurchaseError] = useState<unknown>();

  // Form states: Cancel (rule:415405e53e)
  const [cancelReason, setCancelReason] = useState("");
  const [savingCancel, setSavingCancel] = useState(false);
  const [cancelError, setCancelError] = useState<unknown>();

  async function openDetail(req: EquipmentRequisitionOut) {
    if (selectedReq?.requisition_id === req.requisition_id) {
      setSelectedReq(null);
      setReqDetail(null);
      return;
    }
    setSelectedReq(req);
    setLoadingDetail(true);
    setDetailError(undefined);
    try {
      const d = await getRequisitionFacilityEquipmentRequisitions(req.requisition_id);
      setReqDetail(d);
    } catch (err) {
      setDetailError(err);
      setReqDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function reloadDetail(reqId: number) {
    try {
      const d = await getRequisitionFacilityEquipmentRequisitions(reqId);
      setReqDetail(d);
      setSelectedReq(d);
    } catch (err) {
      setDetailError(err);
    }
  }

  async function submitNewRequisition(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newSpec.trim() || !newJust.trim() || savingNew || !connected) return;
    setSavingNew(true);
    setNewError(undefined);
    try {
      const d = await createRequisitionFacilityEquipmentRequisitions({
        department_id: newDeptId ? Number(newDeptId) : null,
        title: newTitle.trim(),
        specification: newSpec.trim(),
        justification: newJust.trim(),
        quantity: Number(newQty) || 1,
        estimated_cost: newCost ? Number(newCost) : null,
      });
      setShowNewModal(false);
      setNewTitle("");
      setNewSpec("");
      setNewJust("");
      setNewCost("");
      await requisitions.reload();
      setSelectedReq(d);
      setReqDetail(d);
    } catch (err) {
      setNewError(err);
    } finally {
      setSavingNew(false);
    }
  }

  async function submitAddOption(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReq || !optModel.trim() || savingOpt || !connected) return;
    setSavingOpt(true);
    setOptError(undefined);
    try {
      const d = await addOption(selectedReq.requisition_id, {
        make_model: optModel.trim(),
        vendor_id: optVendorId ? Number(optVendorId) : null,
        price: optPrice ? Number(optPrice) : null,
        details: optDetails.trim() || null,
      });
      setShowAddOptionModal(false);
      setOptModel("");
      setOptVendorId("");
      setOptPrice("");
      setOptDetails("");
      setReqDetail(d);
      await requisitions.reload();
    } catch (err) {
      setOptError(err);
    } finally {
      setSavingOpt(false);
    }
  }

  async function submitEvaluation(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReq || !evaluatingOptionId || !evalRemarks.trim() || savingEval || !connected) return;
    setSavingEval(true);
    setEvalError(undefined);
    try {
      const d = await evaluate(selectedReq.requisition_id, {
        option_id: evaluatingOptionId,
        score: Number(evalScore),
        remarks: evalRemarks.trim(),
      });
      setEvaluatingOptionId(null);
      setEvalRemarks("");
      setEvalScore(5);
      setReqDetail(d);
      await requisitions.reload();
    } catch (err) {
      setEvalError(err);
    } finally {
      setSavingEval(false);
    }
  }

  async function submitDecide(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReq || !decideOptionId || !decideNote.trim() || savingDecide || !connected) return;
    setSavingDecide(true);
    setDecideError(undefined);
    try {
      const d = await decide(selectedReq.requisition_id, {
        chosen_option_id: Number(decideOptionId),
        decision_note: decideNote.trim(),
        meeting_id: decideMeetingId ? Number(decideMeetingId) : null,
      });
      setShowDecideModal(false);
      setDecideOptionId("");
      setDecideNote("");
      setDecideMeetingId("");
      setReqDetail(d);
      await requisitions.reload();
    } catch (err) {
      setDecideError(err);
    } finally {
      setSavingDecide(false);
    }
  }

  async function submitPurchased(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReq || !purchaseAssetId || savingPurchase || !connected) return;
    setSavingPurchase(true);
    setPurchaseError(undefined);
    try {
      const d = await markPurchased(selectedReq.requisition_id, {
        asset_id: Number(purchaseAssetId),
      });
      setShowPurchaseModal(false);
      setPurchaseAssetId("");
      setReqDetail(d);
      await requisitions.reload();
    } catch (err) {
      setPurchaseError(err);
    } finally {
      setSavingPurchase(false);
    }
  }

  async function submitCancel(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReq || !cancelReason.trim() || savingCancel || !connected) return;
    setSavingCancel(true);
    setCancelError(undefined);
    try {
      const d = await cancelFacilityEquipmentRequisitions(selectedReq.requisition_id, {
        reason: cancelReason.trim(),
      });
      setShowCancelModal(false);
      setCancelReason("");
      setReqDetail(d);
      await requisitions.reload();
    } catch (err) {
      setCancelError(err);
    } finally {
      setSavingCancel(false);
    }
  }

  const items: EquipmentRequisitionOut[] = Array.isArray(requisitions.data) ? requisitions.data : [];
  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.requisition_number.toLowerCase().includes(q) ||
      item.title.toLowerCase().includes(q) ||
      item.requested_by_name.toLowerCase().includes(q) ||
      (item.department_name && item.department_name.toLowerCase().includes(q))
    );
  });

  const departmentList: DepartmentOut[] = depts.data || [];
  const vendors: VendorOut[] = vendorList.data || [];
  const equipmentAssets: EquipmentOut[] = equipList.data || [];
  const committeeList: CommitteeOut[] = committees.data || [];

  return (
    <section data-screen="equipment_requisitions" data-unsaved={showNewModal || showDecideModal || showAddOptionModal}>
      <header className="toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>{t("Equipment requisitions", "سامان کی خریداری کی درخواستیں")}</h1>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            className="button-primary"
            data-help="equipment_requisitions.new"
            onClick={() => {
              setShowNewModal(true);
              setNewError(undefined);
            }}
            disabled={!connected}
          >
            {t("+ New requisition", "+ نئی درخواست")}
          </button>
          <button type="button" data-help="equipment_requisitions.help" onClick={onOpenHelp}>
            {t("Help", "مدد")}
          </button>
        </div>
      </header>

      {/* New Requisition Modal */}
      {showNewModal && (
        <form className="card" onSubmit={submitNewRequisition} style={{ marginBottom: "16px", borderColor: "var(--color-primary, #007bff)" }}>
          <h3>{t("Raise Equipment Requisition (MSDS FMS 123)", "سامان کی خریداری کی نئی درخواست")}</h3>
          <p>{t("Ask for equipment with its specification and justification. Specifications cannot be changed after submission.", "سامان کی تفصیلی وضاحت اور ضرورت کا باضابطہ جواز درج کریں۔ بعد میں تبدیلی نہیں کی جا سکے گی۔")}</p>
          <ErrorBox error={newError} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div className="form-group">
              <label htmlFor="new-req-dept"><strong>{t("Department", "شعبہ")}</strong></label>
              <select
                id="new-req-dept"
                data-help="equipment_requisitions.new"
                value={newDeptId}
                onChange={(e) => setNewDeptId(e.target.value)}
                disabled={savingNew || !connected}
              >
                <option value="">{t("— Whole Facility / General —", "— پوری سہولت / عمومی —")}</option>
                {departmentList.filter((d) => d.is_active).map((d) => (
                  <option key={d.department_id} value={d.department_id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="new-req-title"><strong>{t("Equipment title / name", "آلے کا عنوان / نام")}</strong></label>
              <input
                id="new-req-title"
                type="text"
                data-help="equipment_requisitions.new"
                placeholder={t("e.g. Multiparameter Patient Monitor", "مثلاً ملٹی پیرامیٹر پیشنٹ مانیٹر")}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                disabled={savingNew || !connected}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div className="form-group">
              <label htmlFor="new-req-qty"><strong>{t("Quantity", "تعداد")}</strong></label>
              <input
                id="new-req-qty"
                type="number"
                min={1}
                data-help="equipment_requisitions.new"
                value={newQty}
                onChange={(e) => setNewQty(Number(e.target.value))}
                required
                disabled={savingNew || !connected}
              />
            </div>

            <div className="form-group">
              <label htmlFor="new-req-cost"><strong>{t("Estimated cost (PKR)", "تخمینہ لاگت (روپے)")}</strong></label>
              <input
                id="new-req-cost"
                type="number"
                min={0}
                data-help="equipment_requisitions.new"
                placeholder={t("Optional", "اختیاری")}
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
                disabled={savingNew || !connected}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: "12px" }}>
            <label htmlFor="new-req-spec"><strong>{t("Technical specification", "تکنیکی وضاحت اور مطلوبہ اوصاف")}</strong></label>
            <textarea
              id="new-req-spec"
              rows={3}
              data-help="equipment_requisitions.new"
              placeholder={t("Describe required capabilities, standards, power, features...", "مطلوبہ صلاحیت، معیار، بجلی کی تفصیل اور دیگر اوصاف لکھیں...")}
              value={newSpec}
              onChange={(e) => setNewSpec(e.target.value)}
              required
              disabled={savingNew || !connected}
            />
          </div>

          <div className="form-group" style={{ marginBottom: "12px" }}>
            <label htmlFor="new-req-just"><strong>{t("Justification & clinical need", "کلینیکل ضرورت اور جواز")}</strong></label>
            <textarea
              id="new-req-just"
              rows={3}
              data-help="equipment_requisitions.new"
              placeholder={t("Explain why this asset is required, patient workload, safety risk...", "وضاحت کریں کہ یہ سامان کیوں ضروری ہے، مریضوں کا بوجھ، خطرات وغیرہ...")}
              value={newJust}
              onChange={(e) => setNewJust(e.target.value)}
              required
              disabled={savingNew || !connected}
            />
          </div>

          <div className="toolbar" style={{ display: "flex", gap: "8px" }}>
            <button
              type="submit"
              className="button-primary"
              data-help="equipment_requisitions.new"
              disabled={savingNew || !connected || !newTitle.trim() || !newSpec.trim() || !newJust.trim()}
            >
              {savingNew ? t("Submitting...", "جمع ہو رہا ہے...") : t("Submit requisition", "درخواست جمع کریں")}
            </button>
            <button
              type="button"
              data-help="equipment_requisitions.new"
              onClick={() => setShowNewModal(false)}
              disabled={savingNew}
            >
              {t("Cancel", "منسوخ")}
            </button>
          </div>
        </form>
      )}

      {/* Requisitions List */}
      <article className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
          <h2>{t("Requisitions register", "درخواستوں کا رجسٹر")}</h2>
          <div className="toolbar" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="search"
              data-help="equipment_requisitions.filter"
              placeholder={t("Search number, title, requester...", "نمبر، عنوان یا درخواست گزار تلاش کریں...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              data-help="equipment_requisitions.filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">{t("All statuses", "تمام حالتیں")}</option>
              <option value="Open">{t("Open", "کھلی")}</option>
              <option value="Evaluating">{t("Evaluating", "جائزہ زیر غور")}</option>
              <option value="Decided">{t("Decided", "فیصلہ شدہ")}</option>
              <option value="Purchased">{t("Purchased", "خریدا گیا")}</option>
              <option value="Cancelled">{t("Cancelled", "منسوخ")}</option>
            </select>
          </div>
        </div>

        <LoadState {...requisitions} retry={requisitions.reload} />

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>{t("Req #", "درخواست نمبر")}</th>
                <th>{t("Title", "عنوان")}</th>
                <th>{t("Department", "شعبہ")}</th>
                <th>{t("Qty", "تعداد")}</th>
                <th>{t("Estimated cost", "تخمینہ لاگت")}</th>
                <th>{t("Status", "حالت")}</th>
                <th>{t("Requested by", "درخواست گزار")}</th>
                <th>{t("Date", "تاریخ")}</th>
                <th>{t("Actions", "اقدامات")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.requisition_id} className={selectedReq?.requisition_id === item.requisition_id ? "selected" : ""}>
                  <td><strong>{item.requisition_number}</strong></td>
                  <td>{item.title}</td>
                  <td>{item.department_name || t("Facility-wide", "پوری سہولت")}</td>
                  <td>{item.quantity}</td>
                  <td>{item.estimated_cost ? `${item.estimated_cost.toLocaleString()} PKR` : "—"}</td>
                  <td>
                    <span className={`badge badge-${statusColors[item.status] || "secondary"}`}>
                      {item.status}
                    </span>
                  </td>
                  <td>{item.requested_by_name}</td>
                  <td>{item.requested_at ? item.requested_at.slice(0, 10) : "—"}</td>
                  <td>
                    <button
                      type="button"
                      data-help="equipment_requisitions.filter"
                      onClick={() => openDetail(item)}
                    >
                      {selectedReq?.requisition_id === item.requisition_id ? t("Hide", "چھپائیں") : t("Inspect", "معائنہ")}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "16px" }}>
                    {t("No equipment requisitions found.", "کوئی درخواست نہیں ملی۔")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {/* Selected Requisition Detail Inspector */}
      {selectedReq && (
        <article className="card" style={{ marginTop: "16px", background: "var(--color-bg-secondary, #fafafa)", padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
            <div>
              <h3>
                {selectedReq.requisition_number} · {selectedReq.title} (
                <span className={`badge badge-${statusColors[selectedReq.status] || "secondary"}`}>
                  {selectedReq.status}
                </span>
                )
              </h3>
              <p>
                <strong>{t("Requested by", "درخواست گزار")}:</strong> {selectedReq.requested_by_name} |{" "}
                <strong>{t("Department", "شعبہ")}:</strong> {selectedReq.department_name || t("General", "عمومی")} |{" "}
                <strong>{t("Quantity", "تعداد")}:</strong> {selectedReq.quantity}
              </p>
            </div>

            {/* Lifecycle Action Buttons */}
            <div className="toolbar" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {(selectedReq.status === "Open" || selectedReq.status === "Evaluating") && (
                <>
                  <button
                    type="button"
                    className="button-primary"
                    data-help="equipment_requisitions.option"
                    onClick={() => {
                      setShowAddOptionModal(true);
                      setOptError(undefined);
                    }}
                    disabled={!connected}
                  >
                    {t("+ Add model / option", "+ ماڈل / پیشکش شامل کریں")}
                  </button>
                  <button
                    type="button"
                    className="button-success"
                    data-help="equipment_requisitions.decide"
                    onClick={() => {
                      setShowDecideModal(true);
                      setDecideError(undefined);
                    }}
                    disabled={!connected}
                  >
                    {t("Decide option", "ماڈل کا فیصلہ کریں")}
                  </button>
                </>
              )}

              {selectedReq.status === "Decided" && (
                <button
                  type="button"
                  className="button-success"
                  data-help="equipment_requisitions.purchase"
                  onClick={() => {
                    setShowPurchaseModal(true);
                    setPurchaseError(undefined);
                  }}
                  disabled={!connected}
                >
                  {t("Record purchase into inventory", "خریداری رجسٹر میں درج کریں")}
                </button>
              )}

              {selectedReq.status !== "Purchased" && selectedReq.status !== "Cancelled" && (
                <button
                  type="button"
                  className="button-danger"
                  data-help="equipment_requisitions.cancel"
                  onClick={() => {
                    setShowCancelModal(true);
                    setCancelError(undefined);
                  }}
                  disabled={!connected}
                >
                  {t("Cancel requisition", "درخواست منسوخ کریں")}
                </button>
              )}
            </div>
          </div>

          <ErrorBox error={detailError} />
          {loadingDetail && <p>{t("Loading requisition details...", "تفصیلات لوڈ ہو رہی ہیں...")}</p>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div className="card" style={{ background: "#fff", padding: "12px" }}>
              <h4>{t("Technical Specification", "تکنیکی وضاحت")}</h4>
              <p style={{ whiteSpace: "pre-wrap" }}>{selectedReq.specification}</p>
            </div>
            <div className="card" style={{ background: "#fff", padding: "12px" }}>
              <h4>{t("Justification", "جواز اور ضرورت")}</h4>
              <p style={{ whiteSpace: "pre-wrap" }}>{selectedReq.justification}</p>
            </div>
          </div>

          {selectedReq.decision_note && (
            <div className="card" style={{ background: "#e8f4fd", padding: "12px", marginBottom: "16px" }}>
              <h4>{t("Decision Record (MSDS FMS 123)", "فیصلہ کا باضابطہ ریکارڈ")}</h4>
              <p>
                <strong>{t("Decided by", "فیصلہ کنندہ")}:</strong> {selectedReq.decided_by_name} ({selectedReq.decided_at?.slice(0, 10)})
              </p>
              <p><strong>{t("Decision rationale", "فیصلہ کا جواز")}:</strong> {selectedReq.decision_note}</p>
              {selectedReq.asset_id && (
                <p>
                  <strong>{t("Purchased asset ID in equipment inventory", "رجسٹر میں شامل اثاثہ نمبر")}: </strong>
                  <span className="badge badge-success">Asset #{selectedReq.asset_id}</span>
                </p>
              )}
            </div>
          )}

          {selectedReq.cancel_reason && (
            <div className="card" style={{ background: "#f8d7da", padding: "12px", marginBottom: "16px" }}>
              <h4>{t("Cancellation Reason (rule:415405e53e)", "منسوخی کی وجہ")}</h4>
              <p>{selectedReq.cancel_reason}</p>
            </div>
          )}

          {/* Form Modal: Add Model Option */}
          {showAddOptionModal && (
            <form className="card" onSubmit={submitAddOption} style={{ marginBottom: "16px", background: "#fff", border: "2px solid #007bff" }}>
              <h4>{t("Add Model / Option on Offer", "پیشکش کردہ ماڈل شامل کریں")}</h4>
              <ErrorBox error={optError} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div className="form-group">
                  <label htmlFor="opt-model"><strong>{t("Make & model", "سازندہ اور ماڈل")}</strong></label>
                  <input
                    id="opt-model"
                    type="text"
                    data-help="equipment_requisitions.option"
                    placeholder={t("e.g. Mindray ePM 12M", "مثلاً مائنڈرے ePM 12M")}
                    value={optModel}
                    onChange={(e) => setOptModel(e.target.value)}
                    required
                    disabled={savingOpt || !connected}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="opt-vendor"><strong>{t("Vendor / Supplier", "سپلائر / ٹھیکیدار")}</strong></label>
                  <select
                    id="opt-vendor"
                    data-help="equipment_requisitions.option"
                    value={optVendorId}
                    onChange={(e) => setOptVendorId(e.target.value)}
                    disabled={savingOpt || !connected}
                  >
                    <option value="">{t("— Select vendor —", "— سپلائر منتخب کریں —")}</option>
                    {vendors.map((v) => (
                      <option key={v.vendor_id} value={v.vendor_id}>
                        {v.name} ({v.vendor_type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div className="form-group">
                  <label htmlFor="opt-price"><strong>{t("Quoted price (PKR)", "قیمت (روپے)")}</strong></label>
                  <input
                    id="opt-price"
                    type="number"
                    min={0}
                    data-help="equipment_requisitions.option"
                    value={optPrice}
                    onChange={(e) => setOptPrice(e.target.value)}
                    disabled={savingOpt || !connected}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="opt-details"><strong>{t("Details & features", "تفصیلات اور اوصاف")}</strong></label>
                  <input
                    id="opt-details"
                    type="text"
                    data-help="equipment_requisitions.option"
                    placeholder={t("Warranty, accessories, delivery time...", "وارنٹی، سامان، ترسیل کی مدت...")}
                    value={optDetails}
                    onChange={(e) => setOptDetails(e.target.value)}
                    disabled={savingOpt || !connected}
                  />
                </div>
              </div>

              <div className="toolbar" style={{ display: "flex", gap: "8px" }}>
                <button
                  type="submit"
                  className="button-primary"
                  data-help="equipment_requisitions.option"
                  disabled={savingOpt || !connected || !optModel.trim()}
                >
                  {savingOpt ? t("Adding...", "شامل ہو رہا ہے...") : t("Add model", "ماڈل شامل کریں")}
                </button>
                <button
                  type="button"
                  data-help="equipment_requisitions.option"
                  onClick={() => setShowAddOptionModal(false)}
                  disabled={savingOpt}
                >
                  {t("Cancel", "منسوخ")}
                </button>
              </div>
            </form>
          )}

          {/* Form Modal: Evaluate Option (rule:4364cb281f) */}
          {evaluatingOptionId && (
            <form className="card" onSubmit={submitEvaluation} style={{ marginBottom: "16px", background: "#fff", border: "2px solid #ffc107" }}>
              <h4>{t("Evaluate Equipment Model (rule:4364cb281f)", "ماڈل کا تکنیکی جائزہ اور اسکور")}</h4>
              <p>{t("The staff who will use the equipment must evaluate each model with a 1–5 score and technical remarks.", "آلات استعمال کرنے والا عملہ ہر ماڈل کو 1 سے 5 تک اسکور اور تفصیلی تاثرات کے ساتھ جانچے گا۔")}</p>
              <ErrorBox error={evalError} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px", marginBottom: "12px" }}>
                <div className="form-group">
                  <label htmlFor="eval-score"><strong>{t("Score (1=Poor, 5=Excellent)", "اسکور (1=ناقص، 5=بہترین)")}</strong></label>
                  <select
                    id="eval-score"
                    data-help="equipment_requisitions.evaluate"
                    value={evalScore}
                    onChange={(e) => setEvalScore(Number(e.target.value))}
                    disabled={savingEval || !connected}
                  >
                    <option value={5}>5 - {t("Excellent", "بہترین")}</option>
                    <option value={4}>4 - {t("Very good", "بہت اچھا")}</option>
                    <option value={3}>3 - {t("Adequate / Acceptable", "مناسب / قابل قبول")}</option>
                    <option value={2}>2 - {t("Marginal", "معمولی")}</option>
                    <option value={1}>1 - {t("Poor / Unacceptable", "ناقص / ناقابل قبول")}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="eval-remarks"><strong>{t("Evaluation remarks & clinical assessment", "تکنیکی تاثرات اور طبی جائزہ")}</strong></label>
                  <input
                    id="eval-remarks"
                    type="text"
                    data-help="equipment_requisitions.evaluate"
                    placeholder={t("Ease of use, build quality, reliability, clinical fit...", "استعمال میں آسانی، پائیداری، طبی موزونیت...")}
                    value={evalRemarks}
                    onChange={(e) => setEvalRemarks(e.target.value)}
                    required
                    disabled={savingEval || !connected}
                  />
                </div>
              </div>

              <div className="toolbar" style={{ display: "flex", gap: "8px" }}>
                <button
                  type="submit"
                  className="button-warning"
                  data-help="equipment_requisitions.evaluate"
                  disabled={savingEval || !connected || !evalRemarks.trim()}
                >
                  {savingEval ? t("Recording...", "درج ہو رہا ہے...") : t("Record evaluation", "جائزہ درج کریں")}
                </button>
                <button
                  type="button"
                  data-help="equipment_requisitions.evaluate"
                  onClick={() => setEvaluatingOptionId(null)}
                  disabled={savingEval}
                >
                  {t("Cancel", "منسوخ")}
                </button>
              </div>
            </form>
          )}

          {/* Form Modal: Decide Option (rule:28f12beb07) */}
          {showDecideModal && (
            <form className="card" onSubmit={submitDecide} style={{ marginBottom: "16px", background: "#fff", border: "2px solid #28a745" }}>
              <h4>{t("Decide / Select Equipment Model (rule:28f12beb07)", "ماڈل کے انتخاب کا باضابطہ فیصلہ")}</h4>
              <p>
                {t(
                  "The requester cannot decide (SELF_APPROVAL_FORBIDDEN), and the chosen model requires an evaluation by someone other than the decider (EQUIPMENT_EVALUATION_REQUIRED).",
                  "درخواست گزار خود فیصلہ نہیں کر سکتا، اور منتخب ماڈل کا جائزہ کسی دوسرے ملازم کا لیا ہونا ضروری ہے۔"
                )}
              </p>
              <ErrorBox error={decideError} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div className="form-group">
                  <label htmlFor="decide-option"><strong>{t("Selected model option", "منتخب ماڈل")}</strong></label>
                  <select
                    id="decide-option"
                    data-help="equipment_requisitions.decide"
                    value={decideOptionId}
                    onChange={(e) => setDecideOptionId(e.target.value)}
                    required
                    disabled={savingDecide || !connected}
                  >
                    <option value="">{t("— Select an evaluated model —", "— جائزہ شدہ ماڈل چنیں —")}</option>
                    {reqDetail?.options.map((opt) => (
                      <option key={opt.option_id} value={opt.option_id}>
                        {opt.make_model} (Avg: {opt.average_score !== null ? opt.average_score.toFixed(1) : "None"}, {opt.evaluation_count} evals)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="decide-meeting"><strong>{t("Committee meeting (optional)", "کمیٹی کا اجلاس (اختیاری)")}</strong></label>
                  <select
                    id="decide-meeting"
                    data-help="equipment_requisitions.decide"
                    value={decideMeetingId}
                    onChange={(e) => setDecideMeetingId(e.target.value)}
                    disabled={savingDecide || !connected}
                  >
                    <option value="">{t("— No committee meeting linked —", "— کوئی کمیٹی اجلاس منسلک نہیں —")}</option>
                    {committeeList.map((c) => (
                      <option key={c.committee_id} value={c.committee_id}>
                        {c.name} ({c.kind})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label htmlFor="decide-note"><strong>{t("Decision note & rationale", "فیصلے کی تفصیل اور جواز")}</strong></label>
                <textarea
                  id="decide-note"
                  rows={3}
                  data-help="equipment_requisitions.decide"
                  placeholder={t("State why this model was chosen, technical suitability, budget approval...", "بتائیں کہ یہ ماڈل کیوں منتخب کیا گیا، بجٹ منظوری اور طبی موزونیت...")}
                  value={decideNote}
                  onChange={(e) => setDecideNote(e.target.value)}
                  required
                  disabled={savingDecide || !connected}
                />
              </div>

              <div className="toolbar" style={{ display: "flex", gap: "8px" }}>
                <button
                  type="submit"
                  className="button-success"
                  data-help="equipment_requisitions.decide"
                  disabled={savingDecide || !connected || !decideOptionId || !decideNote.trim()}
                >
                  {savingDecide ? t("Deciding...", "فیصلہ ہو رہا ہے...") : t("Confirm decision", "فیصلہ محفوظ کریں")}
                </button>
                <button
                  type="button"
                  data-help="equipment_requisitions.decide"
                  onClick={() => setShowDecideModal(false)}
                  disabled={savingDecide}
                >
                  {t("Cancel", "منسوخ")}
                </button>
              </div>
            </form>
          )}

          {/* Form Modal: Mark Purchased */}
          {showPurchaseModal && (
            <form className="card" onSubmit={submitPurchased} style={{ marginBottom: "16px", background: "#fff", border: "2px solid #28a745" }}>
              <h4>{t("Link Purchased Asset in Equipment Register", "خریداری کو آلات کے رجسٹر سے منسلک کریں")}</h4>
              <p>{t("Select the registered equipment item from the facility register to link this requisition.", "سہولت کے رجسٹر سے رجسٹرڈ آلہ چنیں تاکہ خریداری مکمل نشان زد ہو۔")}</p>
              <ErrorBox error={purchaseError} />

              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label htmlFor="purchase-asset"><strong>{t("Equipment asset item", "آلہ / اثاثہ")}</strong></label>
                <select
                  id="purchase-asset"
                  data-help="equipment_requisitions.purchase"
                  value={purchaseAssetId}
                  onChange={(e) => setPurchaseAssetId(e.target.value)}
                  required
                  disabled={savingPurchase || !connected}
                >
                  <option value="">{t("— Select asset from equipment register —", "— رجسٹر سے آلہ منتخب کریں —")}</option>
                  {equipmentAssets.map((a) => (
                    <option key={a.asset_id} value={a.asset_id}>
                      {a.asset_tag} — {a.name} ({a.category}, {a.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="toolbar" style={{ display: "flex", gap: "8px" }}>
                <button
                  type="submit"
                  className="button-success"
                  data-help="equipment_requisitions.purchase"
                  disabled={savingPurchase || !connected || !purchaseAssetId}
                >
                  {savingPurchase ? t("Linking...", "ربط جاری...") : t("Mark purchased", "خریداری درج کریں")}
                </button>
                <button
                  type="button"
                  data-help="equipment_requisitions.purchase"
                  onClick={() => setShowPurchaseModal(false)}
                  disabled={savingPurchase}
                >
                  {t("Cancel", "منسوخ")}
                </button>
              </div>
            </form>
          )}

          {/* Form Modal: Cancel Requisition (rule:415405e53e) */}
          {showCancelModal && (
            <form className="card" onSubmit={submitCancel} style={{ marginBottom: "16px", background: "#fff", border: "2px solid #dc3545" }}>
              <h4>{t("Cancel Equipment Requisition (rule:415405e53e)", "سامان کی درخواست منسوخ کریں")}</h4>
              <p>{t("Once cancelled, this requisition cannot be reopened. Raise a new requisition if specifications change.", "منسوخ ہونے کے بعد یہ درخواست دوبارہ نہیں کھل سکتی۔ وضاحت بدلنے پر نئی درخواست دیں۔")}</p>
              <ErrorBox error={cancelError} />

              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label htmlFor="cancel-reason"><strong>{t("Cancellation reason", "منسوخی کی وجہ")}</strong></label>
                <textarea
                  id="cancel-reason"
                  rows={2}
                  data-help="equipment_requisitions.cancel"
                  placeholder={t("Provide reason for cancelling requisition...", "درخواست منسوخ کرنے کی وجہ درج کریں...")}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  required
                  disabled={savingCancel || !connected}
                />
              </div>

              <div className="toolbar" style={{ display: "flex", gap: "8px" }}>
                <button
                  type="submit"
                  className="button-danger"
                  data-help="equipment_requisitions.cancel"
                  disabled={savingCancel || !connected || !cancelReason.trim()}
                >
                  {savingCancel ? t("Cancelling...", "منسوخ ہو رہی ہے...") : t("Confirm cancellation", "منسوخی کی تصدیق کریں")}
                </button>
                <button
                  type="button"
                  data-help="equipment_requisitions.cancel"
                  onClick={() => setShowCancelModal(false)}
                  disabled={savingCancel}
                >
                  {t("Back", "واپس")}
                </button>
              </div>
            </form>
          )}

          {/* Models on Offer & Evaluations (rule:4364cb281f) */}
          <h4>{t("Models on Offer & Evaluations (rule:4364cb281f)", "پیشکش کردہ ماڈلز اور ان کے جائزے")}</h4>
          {(!reqDetail?.options || reqDetail.options.length === 0) ? (
            <p>{t("No equipment model options added yet. Add models offered by suppliers.", "ابھی تک کوئی ماڈل شامل نہیں کیا گیا۔ سپلائر کا ماڈل شامل کریں۔")}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {reqDetail.options.map((opt) => (
                <div
                  key={opt.option_id}
                  className="card"
                  style={{
                    background: selectedReq.chosen_option_id === opt.option_id ? "#f0fff4" : "#fff",
                    borderColor: selectedReq.chosen_option_id === opt.option_id ? "#28a745" : "#ddd",
                    padding: "12px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                    <div>
                      <h5 style={{ margin: "0 0 4px 0", fontSize: "1.1rem" }}>
                        {opt.make_model}{" "}
                        {selectedReq.chosen_option_id === opt.option_id && (
                          <span className="badge badge-success">{t("CHOSEN MODEL", "منتخب ماڈل")}</span>
                        )}
                      </h5>
                      <p style={{ margin: "0 0 4px 0" }}>
                        <strong>{t("Vendor", "سپلائر")}:</strong> {opt.vendor_name || t("Unspecified", "غیر متعین")} |{" "}
                        <strong>{t("Price", "قیمت")}:</strong> {opt.price ? `${opt.price.toLocaleString()} PKR` : "—"} |{" "}
                        <strong>{t("Average score", "اوسط اسکور")}:</strong>{" "}
                        <span style={{ fontWeight: "bold", color: (opt.average_score || 0) >= 4 ? "green" : "inherit" }}>
                          {opt.average_score !== null ? `${opt.average_score.toFixed(1)} / 5.0` : t("No evaluations", "کوئی جائزہ نہیں")}
                        </span>{" "}
                        ({opt.evaluation_count} {t("evaluations", "جائزے")})
                      </p>
                      {opt.details && <p style={{ margin: "0 0 4px 0", color: "#666" }}>{opt.details}</p>}
                    </div>

                    {(selectedReq.status === "Open" || selectedReq.status === "Evaluating") && (
                      <button
                        type="button"
                        data-help="equipment_requisitions.evaluate"
                        onClick={() => {
                          setEvaluatingOptionId(opt.option_id);
                          setEvalError(undefined);
                        }}
                        disabled={!connected}
                      >
                        {t("Evaluate this model", "اس ماڈل کا جائزہ لیں")}
                      </button>
                    )}
                  </div>

                  {/* Evaluations List for this Option */}
                  {opt.evaluations.length > 0 && (
                    <div style={{ marginTop: "8px", borderTop: "1px solid #eee", paddingTop: "8px" }}>
                      <strong style={{ fontSize: "0.9rem" }}>{t("Staff evaluations", "عملے کے جائزے")}:</strong>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
                        {opt.evaluations.map((ev) => (
                          <div
                            key={ev.evaluation_id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: "0.9rem",
                              background: "#f9f9f9",
                              padding: "4px 8px",
                              borderRadius: "4px",
                            }}
                          >
                            <span>
                              <strong>{ev.evaluator_name}</strong>: {ev.remarks}
                            </span>
                            <span style={{ fontWeight: "bold" }}>
                              {ev.score} / 5 ⭐ ({ev.evaluated_at.slice(0, 10)})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </article>
      )}
    </section>
  );
}
