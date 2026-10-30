import { useEffect, useState } from "react";
import { api } from "../bridge";
import {
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import {
  WardAdmission,
  type WardContext,
  type WardProps,
} from "../ward-admission";
import { bilingual as t } from "../i18n";
import type {
  OwnMedicinesIn,
  OwnMedicineLineIn,
  OwnMedicineHandBackIn,
  OwnMedicineDestroyIn,
  OwnMedicineOut,
  MedicationWorklistItemOut,
} from "../generated/own_medicines_ward";
import {
  listOwn,
  safetyWorklist,
} from "../generated/own_medicines_ward";
import {
  isHeldMedicine,
  ownMedicinesAccess,
  validateDestroy,
  validateHandBack,
  validateRecordLines,
} from "../own-medicines-policy";

type DraftLine = {
  key: string;
  medicine_name: string;
  strength: string;
  form: string;
  quantity: string;
  batch_no: string;
  expiry_date: string;
};

const createEmptyLine = (): DraftLine => ({
  key: crypto.randomUUID(),
  medicine_name: "",
  strength: "",
  form: "",
  quantity: "",
  batch_no: "",
  expiry_date: "",
});

export function OwnMedicinesWard(props: WardProps) {
  return (
    <section className="own-medicines-screen">
      <h1>{t("Patient's own medicines", "مریض کی اپنی ادویات")}</h1>
      <p className="screen-purpose">
        {t(
          "Record the medicines a patient brings in; hand them back (or destroy them) before the patient leaves.",
          "داخلے پر لائی گئی ادویات کا اندراج کریں؛ ڈسچارج پر واپس کریں یا مریض کی رضامندی و گواہ سے تلف کریں۔",
        )}
      </p>
      <WardAdmission {...props} screenId="own_medicines_ward">
        {(ctx) => <OwnMedicinesContent {...props} ctx={ctx} />}
      </WardAdmission>
    </section>
  );
}

function OwnMedicinesContent({
  ctx,
  user,
  connected,
  stream,
  timeZone,
  establishment,
}: WardProps & { ctx: WardContext }) {
  const admissionId = ctx.admission.admission_id;
  const access = ownMedicinesAccess(ctx.view, user.permissions);
  const [tick, setTick] = useState(0);

  // Form states for recording new pack lines
  const [broughtBy, setBroughtBy] = useState("");
  const [storedAt, setStoredAt] = useState<"Ward" | "Pharmacy">("Ward");
  const [lines, setLines] = useState<DraftLine[]>([createEmptyLine()]);
  const [recordReview, setRecordReview] = useState<OwnMedicinesIn | null>(null);

  // Hand-back dialog state
  const [handBackOpen, setHandBackOpen] = useState(false);
  const [handedTo, setHandedTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Destruction dialog state
  const [destroyTarget, setDestroyTarget] = useState<OwnMedicineOut | null>(null);
  const [destroyReason, setDestroyReason] = useState("");
  const [destroyWitness, setDestroyWitness] = useState("");

  const write = useClinicalWrite(user, "own_meds:" + admissionId, async () => {
    setRecordReview(null);
    setBroughtBy("");
    setLines([createEmptyLine()]);
    setHandBackOpen(false);
    setDestroyTarget(null);
    setTick((n) => n + 1);
  });

  const isRetiring = ctx.view === "open_work";

  // Load medicines list
  const listState = useLoad(
    async () => (access.read ? listOwn(admissionId) : []),
    [admissionId, access.read, tick],
  );

  // Load medication safety worklist for this ward to detect OwnMedicineToIdentify & OwnMedicineToHandBack
  const worklistState = useLoad(
    async () =>
      access.worklist
        ? safetyWorklist({ ward_id: ctx.admission.ward_id })
        : [],
    [ctx.admission.ward_id, access.worklist, tick],
  );

  // Realtime updates
  useEffect(() => {
    if (!connected) return;
    const handleEvent = (e: CustomEvent) => {
      const topic = e.detail?.topic || "";
      if (
        topic.startsWith("session.") ||
        topic.startsWith("system.") ||
        topic === "notification.created"
      ) {
        setTick((t) => t + 1);
      }
    };
    window.addEventListener("haspataal:event" as any, handleEvent);
    return () => window.removeEventListener("haspataal:event" as any, handleEvent);
  }, [connected]);

  const items = listState.data || [];
  const heldItems = items.filter(isHeldMedicine);

  const worklistItems = worklistState.data || [];
  const toIdentifyCount = worklistItems.filter(
    (i) => i.kind === "OwnMedicineToIdentify" && i.admission_id === admissionId,
  ).length;
  const toHandBackCount = worklistItems.filter(
    (i) => i.kind === "OwnMedicineToHandBack" && i.admission_id === admissionId,
  ).length;

  const handleAddLine = () => {
    if (lines.length >= 50) return;
    setLines([...lines, createEmptyLine()]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (
    index: number,
    field: keyof DraftLine,
    value: string,
  ) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };

  const startRecordReview = () => {
    const payload = validateRecordLines(
      broughtBy,
      storedAt,
      lines.map((l) => ({
        medicine_name: l.medicine_name,
        strength: l.strength || null,
        form: l.form || null,
        quantity: l.quantity,
        batch_no: l.batch_no || null,
        expiry_date: l.expiry_date || null,
      })),
    );
    setRecordReview(payload);
  };

  const confirmRecord = () => {
    if (!recordReview) return;
    write.start(
      {
        method: "POST",
        path: `/admissions/${admissionId}/own-medicines`,
        body: recordReview,
        permission: "patient.own_medicine.record",
        protection: "idempotent",
        reconcilePath: `/admissions/${admissionId}/own-medicines`,
        label: t("Record own medicines", "مریض کی ادویات درج کریں"),
      },
      async () => {
        await ctx.preflight("patient.own_medicine.record");
      },
    );
  };

  const openHandBackDialog = () => {
    setSelectedIds(heldItems.map((i) => i.own_medicine_id));
    setHandedTo(ctx.patient.full_name);
    setHandBackOpen(true);
  };

  const confirmHandBack = () => {
    const payload = validateHandBack(handedTo, selectedIds);
    write.start(
      {
        method: "POST",
        path: `/admissions/${admissionId}/own-medicines/hand-back`,
        body: payload,
        permission: "patient.own_medicine.record",
        protection: "idempotent",
        reconcilePath: `/admissions/${admissionId}/own-medicines`,
        label: t("Hand back own medicines", "مریض کی ادویات واپس کریں"),
      },
      async () => {
        await ctx.preflight("patient.own_medicine.record");
      },
    );
  };

  const openDestroyDialog = (item: OwnMedicineOut) => {
    setDestroyTarget(item);
    setDestroyReason(item.is_expired ? "Expired medication; patient agreed to destruction" : "");
    setDestroyWitness("");
  };

  const confirmDestroy = () => {
    if (!destroyTarget) return;
    const payload = validateDestroy(destroyReason, destroyWitness);
    write.start(
      {
        method: "POST",
        path: `/own-medicines/${destroyTarget.own_medicine_id}/destroy`,
        body: payload,
        permission: "patient.own_medicine.record",
        protection: "reconcile",
        reconcilePath: `/admissions/${admissionId}/own-medicines`,
        label: t("Destroy own medicine", "مریض کی دوا تلف کریں"),
      },
      async () => {
        await ctx.preflight("patient.own_medicine.record");
      },
    );
  };

  return (
    <div className="own-medicines-view">
      {isRetiring && (
        <div className="banner retiring" role="status">
          {t(
            "No new own medicines from now on (Inpatient service retiring)",
            "اب سے نئی ادویات کا اندراج بند ہے (ان پیشنٹ خدمت ختم ہو رہی ہے)",
          )}
        </div>
      )}

      {/* Safety Worklist Indicators */}
      {(toIdentifyCount > 0 || toHandBackCount > 0) && (
        <div className="safety-worklist-banner mb-2">
          {toIdentifyCount > 0 && (
            <span className="badge badge-warning me-2">
              {t(
                `${toIdentifyCount} medicine(s) waiting for pharmacist identification`,
                `${toIdentifyCount} دوا فارماسسٹ کی شناخت کی منتظر ہے`,
              )}
            </span>
          )}
          {toHandBackCount > 0 && (
            <span className="badge badge-danger">
              {t(
                `${toHandBackCount} medicine(s) must be handed back or destroyed before discharge clearance`,
                `${toHandBackCount} دوا ڈسچارج سے پہلے واپس یا تلف کرنا ضروری ہے`,
              )}
            </span>
          )}
        </div>
      )}

      <div className="section-toolbar d-flex gap-2 mb-3">
        <button
          type="button"
          className="btn btn-secondary"
          data-help="ownmeds.refresh"
          onClick={() => setTick((t) => t + 1)}
        >
          {t("Refresh medicines list", "فہرست تازہ کریں")}
        </button>

        <button
          type="button"
          className="btn btn-outline-info"
          data-help="ownmeds.worklist"
          onClick={() => setTick((t) => t + 1)}
        >
          {t("Safety worklist", "حفاظتی فہرست")}
        </button>

        {access.handBack && heldItems.length > 0 && (
          <button
            type="button"
            className="btn btn-primary"
            data-help="ownmeds.handback"
            onClick={openHandBackDialog}
          >
            {t("Hand back held medicines", "زیر تحویل ادویات واپس کریں")}
          </button>
        )}
      </div>

      <LoadState
        loading={listState.loading}
        error={listState.error}
        retry={() => setTick((t) => t + 1)}
      />

      <div className="medicines-inventory">
        <h2>{t("Brought-in medicines inventory", "لائی گئی ادویات کی فہرست")}</h2>
        {items.length === 0 ? (
          <Empty>
            {t(
              "No own medicines recorded for this admission.",
              "اس داخلے کے لیے مریض کی اپنی ادویات درج نہیں ہیں۔",
            )}
          </Empty>
        ) : (
          <table className="table own-medicines-table">
            <thead>
              <tr>
                <th>{t("Medicine name", "دوا کا نام")}</th>
                <th>{t("Strength / Form", "طاقت / شکل")}</th>
                <th>{t("Quantity", "مقدار")}</th>
                <th>{t("Batch / Expiry", "بیچ / تاریخ تنسیخ")}</th>
                <th>{t("Storage", "جگہ")}</th>
                <th>{t("Status", "حالت")}</th>
                <th>{t("Pharmacist Match", "فارماسسٹ ملاپ")}</th>
                <th>{t("Actions", "اقدامات")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => {
                const held = isHeldMedicine(m);
                return (
                  <tr key={m.own_medicine_id} className={m.is_expired ? "row-expired" : ""}>
                    <td>
                      <strong>{m.medicine_name}</strong>
                      <div className="text-muted small">
                        {t("Brought by:", "لانے والا:")} {m.brought_by}
                      </div>
                    </td>
                    <td>
                      {[m.strength, m.form].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td>{m.quantity}</td>
                    <td>
                      <div>{m.batch_no ? `Batch: ${m.batch_no}` : "—"}</div>
                      <div className={m.is_expired ? "text-danger font-bold" : "text-muted"}>
                        {m.expiry_date || "—"}
                        {m.is_expired && (
                          <span className="badge badge-danger ms-1">
                            {t("EXPIRED", "ختم شدہ")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-info">{m.stored_at}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          m.status === "Received"
                            ? "badge-warning"
                            : m.status === "Retained"
                            ? "badge-primary"
                            : m.status === "Returned"
                            ? "badge-success"
                            : "badge-secondary"
                        }`}
                      >
                        {m.status === "Received"
                          ? t("Received (Unidentified)", "موصول (شناخت باقی)")
                          : m.status === "Retained"
                          ? t("Retained", "زیر تحویل")
                          : m.status === "Returned"
                          ? t("Returned", "واپس شدہ")
                          : t("Destroyed", "تلف شدہ")}
                      </span>
                      {m.status === "Returned" && m.handed_to && (
                        <div className="text-muted small">
                          {t("To:", "برائے:")} {m.handed_to}
                        </div>
                      )}
                      {m.status === "Destroyed" && m.destroy_witness && (
                        <div className="text-muted small">
                          {t("Witness:", "گواہ:")} {m.destroy_witness}
                        </div>
                      )}
                    </td>
                    <td>
                      {m.drug_name ? (
                        <div>
                          <strong>{m.drug_name}</strong>
                          <div className="text-muted small">
                            {m.identification}
                            {m.identification_note && ` (${m.identification_note})`}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted">
                          {t("Awaiting pharmacy review", "فارمیسی جائزے کا انتظار")}
                        </span>
                      )}
                    </td>
                    <td>
                      {access.destroy && held && (
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          data-help="ownmeds.destroy"
                          onClick={() => openDestroyDialog(m)}
                        >
                          {t("Destroy", "تلف کریں")}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Record New Own Medicines Section */}
      {access.record && (
        <div className="record-own-section card mt-4 p-3">
          <h2>{t("Record medicines brought in on arrival", "داخلے پر لائی گئی ادویات کا اندراج")}</h2>
          <p className="text-muted small">
            {t(
              "One line per pack as it reads on the label. Stored safely on the ward or in pharmacy; NOT used during stay.",
              "ہر پیک کی لیبل کے مطابق الگ سطر۔ وارڈ یا فارمیسی میں محفوظ؛ داخلے کے دوران استعمال نہیں۔",
            )}
          </p>

          <div className="row mb-3">
            <div className="col-md-6">
              <Field
                label={t(
                  "Brought by (Patient or attendant name & relation)",
                  "کون لایا (مریض یا تیماردار کا نام و رشتہ)",
                )}
              >
                <input
                  type="text"
                  className="form-control"
                  data-help="ownmeds.brought_by"
                  value={broughtBy}
                  onChange={(e) => setBroughtBy(e.target.value)}
                  placeholder={t("e.g. Patient herself / Brother Tariq", "مثلاً مریض خود / بھائی طارق")}
                  maxLength={120}
                />
              </Field>
            </div>
            <div className="col-md-6">
              <Field label={t("Storage location", "محفوظ رکھنے کی جگہ")}>
                <select
                  className="form-select"
                  data-help="ownmeds.storage"
                  value={storedAt}
                  onChange={(e) => setStoredAt(e.target.value as "Ward" | "Pharmacy")}
                >
                  <option value="Ward">{t("Ward Cupboard", "وارڈ کی الماری")}</option>
                  <option value="Pharmacy">{t("Hospital Pharmacy", "ہسپتال فارمیسی")}</option>
                </select>
              </Field>
            </div>
          </div>

          <div className="lines-builder">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th style={{ width: "30%" }}>{t("Medicine name (as pack reads)", "دوا کا نام")}</th>
                  <th>{t("Strength", "طاقت")}</th>
                  <th>{t("Form", "شکل")}</th>
                  <th>{t("Quantity left", "باقی مقدار")}</th>
                  <th>{t("Batch #", "بیچ")}</th>
                  <th>{t("Expiry date", "تاریخ تنسیخ")}</th>
                  <th style={{ width: "50px" }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={line.key}>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        data-help="ownmeds.name"
                        value={line.medicine_name}
                        onChange={(e) => handleLineChange(idx, "medicine_name", e.target.value)}
                        placeholder={t("Brand or generic name", "نام")}
                        maxLength={200}
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        data-help="ownmeds.name"
                        value={line.strength}
                        onChange={(e) => handleLineChange(idx, "strength", e.target.value)}
                        placeholder="e.g. 500mg"
                        maxLength={100}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        data-help="ownmeds.name"
                        value={line.form}
                        onChange={(e) => handleLineChange(idx, "form", e.target.value)}
                        placeholder="e.g. Tablet"
                        maxLength={100}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        data-help="ownmeds.quantity"
                        value={line.quantity}
                        onChange={(e) => handleLineChange(idx, "quantity", e.target.value)}
                        placeholder="e.g. 10 tabs"
                        maxLength={50}
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        data-help="ownmeds.name"
                        value={line.batch_no}
                        onChange={(e) => handleLineChange(idx, "batch_no", e.target.value)}
                        placeholder="e.g. B1234"
                        maxLength={100}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        data-help="ownmeds.name"
                        value={line.expiry_date}
                        onChange={(e) => handleLineChange(idx, "expiry_date", e.target.value)}
                        placeholder="YYYY-MM-DD"
                        pattern="\d{4}-\d{2}-\d{2}"
                      />
                    </td>
                    <td>
                      {lines.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          data-help="ownmeds.name"
                          onClick={() => handleRemoveLine(idx)}
                          title={t("Remove line", "سطر ختم کریں")}
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="d-flex justify-content-between mt-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                data-help="ownmeds.name"
                onClick={handleAddLine}
                disabled={lines.length >= 50}
              >
                + {t("Add another pack", "مزید پیک شامل کریں")}
              </button>

              <button
                type="button"
                className="btn btn-primary"
                data-help="ownmeds.review"
                onClick={startRecordReview}
              >
                {t("Review medicines entry", "اندراج کا جائزہ لیں")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Dialog for Recording */}
      {recordReview && (
        <Modal
          title={t("Confirm own medicines recording", "مریض کی ادویات کے اندراج کی تصدیق")}
          onClose={() => setRecordReview(null)}
        >
          <div className="modal-body">
            <p>
              <strong>{t("Brought by:", "لانے والا:")}</strong> {recordReview.brought_by}
            </p>
            <p>
              <strong>{t("Storage:", "جگہ:")}</strong> {recordReview.stored_at}
            </p>
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>{t("Medicine", "دوا")}</th>
                  <th>{t("Strength / Form", "طاقت / شکل")}</th>
                  <th>{t("Quantity", "مقدار")}</th>
                  <th>{t("Expiry", "میعاد")}</th>
                </tr>
              </thead>
              <tbody>
                {recordReview.medicines.map((m, i) => (
                  <tr key={i}>
                    <td>{m.medicine_name}</td>
                    <td>{[m.strength, m.form].filter(Boolean).join(" · ") || "—"}</td>
                    <td>{m.quantity}</td>
                    <td>{m.expiry_date || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="alert alert-info small mt-3">
              {t(
                "These medicines will be held in storage and sent to the pharmacy worklist for identification. They will NOT be administered from patient stock during the stay.",
                "یہ ادویات حفاظت میں رکھی جائیں گی اور شناخت کے لیے فارمیسی فہرست میں جائیں گی۔ قیام کے دوران مریض کی ادویات سے خوراک نہیں دی جائے گی۔",
              )}
            </div>

            <div className="d-flex justify-content-end gap-2 mt-3">
              <button
                type="button"
                className="btn btn-secondary"
                data-help="ownmeds.review"
                onClick={() => setRecordReview(null)}
              >
                {t("Back to edit", "ترمیم پر واپس")}
              </button>
              <button
                type="button"
                className="btn btn-success"
                data-help="ownmeds.confirm"
                disabled={write.busy}
                onClick={confirmRecord}
              >
                {write.busy ? t("Recording...", "اندراج ہو رہا ہے...") : t("Confirm & Save", "تصدیق و محفوظ کریں")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Hand Back Dialog */}
      {handBackOpen && (
        <Modal
          title={t("Hand back patient's own medicines", "مریض کی ادویات واپس کریں")}
          onClose={() => setHandBackOpen(false)}
        >
          <div className="modal-body">
            <p className="text-muted small">
              {t(
                "Hand back held medicines to the patient or attendant before discharge. All held packs must be resolved.",
                "ڈسچارج سے پہلے تمام زیر تحویل ادویات مریض یا تیماردار کو واپس کریں۔",
              )}
            </p>

            <Field
              label={t(
                "Handed to (Patient or attendant name & relation)",
                "کس کو دی گئیں (مریض یا تیماردار کا نام و رشتہ)",
              )}
            >
              <input
                type="text"
                className="form-control"
                data-help="ownmeds.handed_to"
                value={handedTo}
                onChange={(e) => setHandedTo(e.target.value)}
                placeholder={t("e.g. Patient herself / Son Kamran", "مثلاً مریض خود / بیٹا کامران")}
                maxLength={120}
                required
              />
            </Field>

            <label className="form-label mt-3">{t("Packs to hand back:", "واپسی کے لیے ادویات:")}</label>
            <ul className="list-group mb-3">
              {heldItems.map((item) => (
                <li key={item.own_medicine_id} className="list-group-item d-flex justify-content-between align-items-center">
                  <div>
                    <strong>{item.medicine_name}</strong>
                    <div className="text-muted small">{item.quantity} · {item.stored_at}</div>
                  </div>
                  <input
                    type="checkbox"
                    data-help="ownmeds.handed_to"
                    checked={selectedIds.includes(item.own_medicine_id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds([...selectedIds, item.own_medicine_id]);
                      } else {
                        setSelectedIds(selectedIds.filter((id) => id !== item.own_medicine_id));
                      }
                    }}
                  />
                </li>
              ))}
            </ul>

            <div className="d-flex justify-content-end gap-2 mt-3">
              <button
                type="button"
                className="btn btn-secondary"
                data-help="ownmeds.handed_to"
                onClick={() => setHandBackOpen(false)}
              >
                {t("Cancel", "منسوخ")}
              </button>
              <button
                type="button"
                className="btn btn-success"
                data-help="ownmeds.handback_confirm"
                disabled={write.busy || selectedIds.length === 0}
                onClick={confirmHandBack}
              >
                {write.busy ? t("Saving...", "محفوظ ہو رہا ہے...") : t("Confirm Hand Back", "واپسی کی تصدیق")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Destruction Dialog */}
      {destroyTarget && (
        <Modal
          title={t("Destroy patient's own medicine pack", "مریض کی دوا تلف کریں")}
          onClose={() => setDestroyTarget(null)}
        >
          <div className="modal-body">
            <div className="alert alert-warning">
              <strong>{destroyTarget.medicine_name}</strong> ({destroyTarget.quantity})
              <div>
                {t(
                  "Destruction requires the patient's agreement and must be witnessed by another staff member.",
                  "دوا تلف کرنے کے لیے مریض کی رضامندی اور عملے کے دوسرے فرد کی گواہی لازمی ہے۔",
                )}
              </div>
            </div>

            <Field label={t("Destruction reason (Patient agreement / Expired)", "تلفی کی وجہ (مریض کی رضامندی / میعاد ختم)")}>
              <textarea
                className="form-control"
                data-help="ownmeds.destroy_reason"
                rows={3}
                value={destroyReason}
                onChange={(e) => setDestroyReason(e.target.value)}
                placeholder={t(
                  "e.g. Expired pack, damaged, or patient requested safe hospital disposal with consent.",
                  "مثلاً میعاد ختم، پیک خراب، یا مریض نے ہسپتال تلفی کی تحریری رضامندی دی۔",
                )}
                maxLength={300}
                required
              />
            </Field>

            <Field label={t("Witness name and role", "گواہ کا نام اور عہدہ")}>
              <input
                type="text"
                className="form-control"
                data-help="ownmeds.destroy_witness"
                value={destroyWitness}
                onChange={(e) => setDestroyWitness(e.target.value)}
                placeholder={t("e.g. Staff Nurse Zainab (Nursing Officer)", "مثلاً اسٹاف نرس زینب (نرسنگ آفیسر)")}
                maxLength={120}
                required
              />
            </Field>

            <div className="d-flex justify-content-end gap-2 mt-3">
              <button
                type="button"
                className="btn btn-secondary"
                data-help="ownmeds.destroy_reason"
                onClick={() => setDestroyTarget(null)}
              >
                {t("Cancel", "منسوخ")}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                data-help="ownmeds.destroy_confirm"
                disabled={write.busy}
                onClick={confirmDestroy}
              >
                {write.busy ? t("Destroying...", "تلف ہو رہی ہے...") : t("Confirm Destruction", "تلفی کی تصدیق")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <ClinicalWriteFeedback
        write={write}
        onReviewed={() => setTick((t) => t + 1)}
      />
    </div>
  );
}
