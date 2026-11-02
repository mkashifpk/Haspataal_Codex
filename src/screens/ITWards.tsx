import { useState } from "react";
import {
  Field,
  ErrorBox,
  LoadState,
  Empty,
  Details,
  Modal,
  useLoad,
} from "../components";
import { bilingual as t } from "../i18n";
import * as it from "../generated/it_console";
import { useClinicalWrite, ClinicalWriteFeedback } from "../clinical-write";
import { canCloseWard, wardBody } from "../ward-policy";
export function ITWards({
  permissions,
  userId,
  revision,
}: {
  permissions: string[];
  userId: number;
  revision: number;
}) {
  const allowed = permissions.includes("admin.ward.manage");
  const list = useLoad(
    () => (allowed ? it.listWards() : Promise.resolve([])),
    [allowed, revision],
  );
  const [draft, setDraft] = useState<it.WardListItemOut>(),
    [review, setReview] = useState<it.WardIn>(),
    [error, setError] = useState<unknown>(),
    [newWardDraft, setNewWardDraft] = useState<it.WardIn>(),
    [addBedsModal, setAddBedsModal] = useState<{
      ward_id: number;
      name: string;
      labelsText: string;
      overflow: boolean;
    }>(),
    [bedLabelsModal, setBedLabelsModal] = useState<{
      ward_id: number;
      name: string;
      loading: boolean;
      data?: it.BedLabelsOut;
      error?: unknown;
    }>();
  const write = useClinicalWrite(
    { user_id: userId, permissions },
    "it-wards",
    async () => {
      setDraft(undefined);
      setReview(undefined);
      setNewWardDraft(undefined);
      setAddBedsModal(undefined);
      await list.reload();
    },
  );
  if (!allowed) return null;

  async function loadBedLabels(wardId: number, name: string) {
    setBedLabelsModal({ ward_id: wardId, name, loading: true });
    try {
      const data = await it.bedLabels(wardId);
      setBedLabelsModal({ ward_id: wardId, name, loading: false, data });
    } catch (e) {
      setBedLabelsModal({ ward_id: wardId, name, loading: false, error: e });
    }
  }

  function confirm() {
    if (!draft) return;
    try {
      if (draft.code.trim().length < 2 || draft.name.trim().length < 2)
        throw Error(
          t(
            "Enter a ward code and name of at least two characters.",
            "وارڈ کوڈ اور نام کم از کم دو حروف درج کریں۔",
          ),
        );
      if (!draft.is_active && !canCloseWard(draft))
        throw Error(
          t(
            "This ward still has beds in use or patients waiting. Keep it open.",
            "وارڈ میں بستر زیر استعمال یا مریض منتظر ہیں۔ اسے کھلا رکھیں۔",
          ),
        );
      setReview(wardBody(draft));
    } catch (e) {
      setError(e);
    }
  }
  return (
    <section data-testid="it-wards">
      <h3>{t("Wards — open and closed", "وارڈ — کھلے اور بند")}</h3>
      <p>
        {t(
          "Close only when no bed is Reserved, Occupied, Dirty or Cleaning and nobody is waitlisted. Reopen to return the ward and its beds to the matrix.",
          "تب بند کریں جب کوئی بستر محفوظ، زیر استعمال یا صفائی میں نہ ہو اور کوئی مریض منتظر نہ ہو۔ دوبارہ کھولنے سے وارڈ اور بستر فہرست میں لوٹتے ہیں۔",
        )}
      </p>
      <div className="actions" style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <button
          data-help="settings.it.wards"
          disabled={write.blocked || !!draft}
          onClick={list.reload}
        >
          {t("Refresh wards", "وارڈ تازہ کریں")}
        </button>
        <button
          data-help="settings.it.wards"
          disabled={write.blocked || !!draft || !!newWardDraft}
          onClick={() =>
            setNewWardDraft({
              code: "",
              name: "",
              ward_type: "General",
              gender_restriction: "any",
              is_active: true,
            })
          }
        >
          {t("Add new ward", "نیا وارڈ شامل کریں")}
        </button>
      </div>
      <LoadState {...list} retry={list.reload} />
      <ClinicalWriteFeedback write={write} />
      {!list.loading && !list.error && !list.data?.length && (
        <Empty>{t("No wards returned.", "کوئی وارڈ نہیں آیا۔")}</Empty>
      )}
      {!list.error &&
        list.data?.map((w) => (
          <article className="card" key={w.ward_id}>
            <h4>
              {w.name} · {w.code}
            </h4>
            <p>
              {w.is_active ? t("Open", "کھلا") : t("Closed", "بند")} · {w.beds}{" "}
              {t("beds", "بستر")} · {w.waitlisted} {t("waiting", "منتظر")}
            </p>
            {w.beds_in_use.length > 0 && (
              <p>
                {t("Beds in use", "زیر استعمال بستر")}:{" "}
                {w.beds_in_use.join(", ")}
              </p>
            )}
            {w.is_active && !canCloseWard(w) && (
              <p className="notice" style={{ color: "#d9534f", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                {t(
                  `Cannot close ward (WARD_IN_USE): ${w.beds_in_use.length} bed(s) in use (${w.beds_in_use.join(", ")}), ${w.waitlisted} waiting.`,
                  `وارڈ بند نہیں ہو سکتا (WARD_IN_USE): ${w.beds_in_use.length} بستر زیر استعمال (${w.beds_in_use.join("، ")}), ${w.waitlisted} منتظر۔`
                )}
              </p>
            )}
            <div className="actions" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button
                data-help="settings.it.wards"
                disabled={write.blocked || !!draft}
                onClick={() => {
                  setDraft(structuredClone(w));
                  setError(undefined);
                  write.clearError();
                }}
              >
                {t("Edit ward", "وارڈ میں ترمیم")}
              </button>
              <button
                data-help="settings.it.wards"
                disabled={
                  write.blocked || !!draft || (w.is_active && !canCloseWard(w))
                }
                onClick={() => {
                  setDraft({ ...w, is_active: !w.is_active });
                  setError(undefined);
                  write.clearError();
                }}
              >
                {w.is_active
                  ? t("Close ward", "وارڈ بند کریں")
                  : t("Reopen ward", "وارڈ دوبارہ کھولیں")}
              </button>
              <button
                data-help="settings.it.wards"
                disabled={write.blocked || !!draft}
                onClick={() =>
                  setAddBedsModal({
                    ward_id: w.ward_id,
                    name: w.name,
                    labelsText: "",
                    overflow: false,
                  })
                }
              >
                {t("Add beds", "بستر شامل کریں")}
              </button>
              <button
                data-help="settings.it.wards"
                disabled={write.blocked || !!draft}
                onClick={() => void loadBedLabels(w.ward_id, w.name)}
              >
                {t("Bed QR labels", "بیڈ کیو آر لیبلز")}
              </button>
            </div>
          </article>
        ))}
      {draft && (
        <Modal
          title={t("Review ward change", "وارڈ تبدیلی کا جائزہ")}
          onClose={() => {
            if (!write.blocked) {
              setDraft(undefined);
              setReview(undefined);
            }
          }}
        >
          <ErrorBox error={error} />
          <ClinicalWriteFeedback write={write} />
          {!!write.error && !write.blocked && <button data-help="settings.it.wards" onClick={async()=>{try{const current=(await it.listWards()).find(w=>w.ward_id===draft.ward_id);if(!current)throw Error(t('The ward no longer exists. Keep the draft and ask IT.','وارڈ موجود نہیں۔ مسودہ رکھ کر آئی ٹی سے کہیں۔'));setDraft({...current,...wardBody(draft),department_id:current.department_id,room_charge_service_id:current.room_charge_service_id} as it.WardListItemOut);setReview(undefined);write.clearError();await list.reload();}catch(e){setError(e);}}}>{t('Read ward; keep my draft','وارڈ پڑھیں؛ میرا مسودہ رکھیں')}</button>}
          <fieldset disabled={write.blocked || !!review} data-unsaved="true">
            <Field label={t("Ward code", "وارڈ کوڈ")}>
              <input
                data-help="settings.it.wards"
                name="code"
                value={draft.code}
                maxLength={20}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
              />
            </Field>
            <Field label={t("Ward name", "وارڈ کا نام")}>
              <input
                data-help="settings.it.wards"
                name="name"
                value={draft.name}
                maxLength={100}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label={t("Ward type", "وارڈ کی قسم")}>
              <select
                data-help="settings.it.wards"
                name="ward_type"
                value={draft.ward_type}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    ward_type: e.target.value as it.WardIn["ward_type"],
                  })
                }
              >
                {[
                  "General",
                  "Private",
                  "SemiPrivate",
                  "ICU",
                  "CCU",
                  "NICU",
                  "Surgical",
                  "Pediatric",
                  "Maternity",
                  "Emergency",
                  "Isolation",
                  "Other",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label={t("Gender restriction", "صنف کی پابندی")}>
              <select
                data-help="settings.it.wards"
                name="gender_restriction"
                value={draft.gender_restriction}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    gender_restriction: e.target
                      .value as it.WardListItemOut["gender_restriction"],
                  })
                }
              >
                {["any", "male", "female"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <p>
              {t(
                "The department and bed-day charging arrangement stay as recorded for this ward.",
                "شعبہ اور یومیہ بستر چارج اس وارڈ کے اصل ریکارڈ کے مطابق رہیں گے۔",
              )}
            </p>
            <label>
              <input name="is_active"
                data-help="settings.it.wards"
                type="checkbox"
                checked={draft.is_active}
                disabled={!canCloseWard(draft) && draft.is_active}
                onChange={(e) =>
                  setDraft({ ...draft, is_active: e.target.checked })
                }
              />
              {t("Ward open", "وارڈ کھلا ہے")}
            </label>
            <button data-help="settings.it.wards" onClick={confirm}>
              {t("Review change", "تبدیلی کا جائزہ")}
            </button>
          </fieldset>
          {review && (
            <>
              <Details value={review} />
              <button
                data-help="settings.it.wards"
                disabled={write.blocked}
                onClick={() => setReview(undefined)}
              >
                {t("Back to edit", "ترمیم پر واپس")}
              </button>
              <button
                data-help="settings.it.wards"
                disabled={write.blocked || !!write.error}
                onClick={() =>
                  write.start(
                    {
                      method: "PUT",
                      path: "/admin/wards/" + draft.ward_id,
                      body: review,
                      permission: "admin.ward.manage",
                      protection: "reconcile",
                      reconcilePath: "/admin/wards",
                      label: "Ward change",
                    },
                    async () => {
                      const current = (await it.listWards()).find(
                        (w) => w.ward_id === draft.ward_id,
                      );
                      if (
                        !current ||
                        current.row_version !== draft.row_version ||
                        (!review.is_active && !canCloseWard(current))
                      )
                        throw Error(
                          t(
                            "The ward changed. Refresh its server record before a new review; your draft is kept.",
                            "وارڈ بدلا۔ نئے جائزے سے پہلے تازہ ریکارڈ پڑھیں؛ مسودہ محفوظ ہے۔",
                          ),
                        );
                    },
                  )
                }
              >
                {t("Confirm ward change", "وارڈ تبدیلی کی تصدیق")}
              </button>
            </>
          )}
        </Modal>
      )}
      {newWardDraft && (
        <Modal
          title={t("Add new ward", "نیا وارڈ شامل کریں")}
          onClose={() => {
            if (!write.blocked) setNewWardDraft(undefined);
          }}
        >
          <ErrorBox error={error} />
          <ClinicalWriteFeedback write={write} />
          <fieldset disabled={write.blocked} data-unsaved="true">
            <Field label={t("Ward code", "وارڈ کوڈ")}>
              <input
                data-help="settings.it.wards"
                value={newWardDraft.code}
                maxLength={20}
                placeholder="e.g. ICU-A"
                onChange={(e) =>
                  setNewWardDraft({ ...newWardDraft, code: e.target.value })
                }
              />
            </Field>
            <Field label={t("Ward name", "وارڈ کا نام")}>
              <input
                data-help="settings.it.wards"
                value={newWardDraft.name}
                maxLength={100}
                placeholder="e.g. Intensive Care Unit A"
                onChange={(e) =>
                  setNewWardDraft({ ...newWardDraft, name: e.target.value })
                }
              />
            </Field>
            <Field label={t("Ward type", "وارڈ کی قسم")}>
              <select
                data-help="settings.it.wards"
                value={newWardDraft.ward_type}
                onChange={(e) =>
                  setNewWardDraft({
                    ...newWardDraft,
                    ward_type: e.target.value as any,
                  })
                }
              >
                {[
                  "General",
                  "Private",
                  "SemiPrivate",
                  "ICU",
                  "CCU",
                  "NICU",
                  "Surgical",
                  "Pediatric",
                  "Maternity",
                  "Emergency",
                  "Isolation",
                  "Other",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label={t("Gender restriction", "صنف کی پابندی")}>
              <select
                data-help="settings.it.wards"
                value={newWardDraft.gender_restriction}
                onChange={(e) =>
                  setNewWardDraft({
                    ...newWardDraft,
                    gender_restriction: e.target.value as any,
                  })
                }
              >
                {["any", "male", "female"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <label style={{ display: "block", margin: "0.75rem 0" }}>
              <input
                data-help="settings.it.wards"
                type="checkbox"
                checked={newWardDraft.is_active}
                onChange={(e) =>
                  setNewWardDraft({
                    ...newWardDraft,
                    is_active: e.target.checked,
                  })
                }
              />
              {" "}{t("Ward active on creation", "تشکیل پر وارڈ فعال ہے")}
            </label>
            <div className="actions" style={{ display: "flex", gap: "0.5rem" }}>
              <button
                data-help="settings.it.wards"
                onClick={() => setNewWardDraft(undefined)}
              >
                {t("Cancel", "منسوخ")}
              </button>
              <button
                data-help="settings.it.wards"
                className="primary"
                disabled={
                  write.blocked ||
                  newWardDraft.code.trim().length < 2 ||
                  newWardDraft.name.trim().length < 2
                }
                onClick={() =>
                  write.start(
                    {
                      method: "POST",
                      path: "/admin/wards",
                      body: newWardDraft,
                      permission: "admin.ward.manage",
                      protection: "reconcile",
                      reconcilePath: "/admin/wards",
                      label: "Add ward",
                    },
                    async () => {
                      setNewWardDraft(undefined);
                      await list.reload();
                    },
                  )
                }
              >
                {t("Create ward", "وارڈ بنائیں")}
              </button>
            </div>
          </fieldset>
        </Modal>
      )}
      {addBedsModal && (
        <Modal
          title={t(
            `Add beds to ${addBedsModal.name}`,
            `${addBedsModal.name} میں بیڈز شامل کریں`,
          )}
          onClose={() => {
            if (!write.blocked) setAddBedsModal(undefined);
          }}
        >
          <ErrorBox error={error} />
          <ClinicalWriteFeedback write={write} />
          <fieldset disabled={write.blocked} data-unsaved="true">
            <Field
              label={t(
                "Bed labels (comma or line separated)",
                "بیڈ لیبلز (کوما یا نئی لائن سے الگ)",
              )}
            >
              <textarea
                data-help="settings.it.wards"
                rows={4}
                value={addBedsModal.labelsText}
                placeholder="e.g. B-01, B-02, B-03"
                onChange={(e) =>
                  setAddBedsModal({
                    ...addBedsModal,
                    labelsText: e.target.value,
                  })
                }
              />
            </Field>
            <label style={{ display: "block", margin: "0.75rem 0" }}>
              <input
                data-help="settings.it.wards"
                type="checkbox"
                checked={addBedsModal.overflow}
                onChange={(e) =>
                  setAddBedsModal({
                    ...addBedsModal,
                    overflow: e.target.checked,
                  })
                }
              />
              {" "}{t("Allow overflow placement", "اضافی گنجائش کی اجازت دیں")}
            </label>
            <div className="actions" style={{ display: "flex", gap: "0.5rem" }}>
              <button
                data-help="settings.it.wards"
                onClick={() => setAddBedsModal(undefined)}
              >
                {t("Cancel", "منسوخ")}
              </button>
              <button
                data-help="settings.it.wards"
                className="primary"
                disabled={
                  write.blocked ||
                  addBedsModal.labelsText
                    .split(/[\n,]+/)
                    .map((s) => s.trim())
                    .filter(Boolean).length === 0
                }
                onClick={() => {
                  const labels = addBedsModal.labelsText
                    .split(/[\n,]+/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  write.start(
                    {
                      method: "POST",
                      path: `/admin/wards/${addBedsModal.ward_id}/beds`,
                      body: {
                        labels,
                        is_overflow_allowed: addBedsModal.overflow,
                      },
                      permission: "admin.ward.manage",
                      protection: "reconcile",
                      reconcilePath: "/admin/wards",
                      label: "Add beds",
                    },
                    async () => {
                      setAddBedsModal(undefined);
                      await list.reload();
                    },
                  );
                }}
              >
                {t("Add beds", "بیڈز شامل کریں")}
              </button>
            </div>
          </fieldset>
        </Modal>
      )}
      {bedLabelsModal && (
        <Modal
          title={t(
            `Bed QR Stickers — ${bedLabelsModal.name}`,
            `بیڈ کیو آر اسٹیکرز — ${bedLabelsModal.name}`,
          )}
          onClose={() => setBedLabelsModal(undefined)}
        >
          <p>
            {t(
              "Print bed QR stickers for cleaning kiosks and bedside scanning (Rule rule:05369643ae).",
              "صفائی کیوسک اور بستر کے قریب اسکیننگ کے لیے بیڈ کیو آر اسٹیکرز پرنٹ کریں (قاعدہ rule:05369643ae)۔",
            )}
          </p>
          {bedLabelsModal.loading && (
            <p>{t("Loading bed labels...", "بیڈ لیبلز لوڈ ہو رہے ہیں...")}</p>
          )}
          {Boolean(bedLabelsModal.error) && <ErrorBox error={bedLabelsModal.error} />}
          {bedLabelsModal.data && (
            <div>
              <div
                className="actions"
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  marginBottom: "1rem",
                }}
              >
                <button
                  data-help="settings.it.wards"
                  className="primary"
                  onClick={() => window.print()}
                >
                  {t("Print bed stickers", "بیڈ اسٹیکرز پرنٹ کریں")}
                </button>
                <button
                  data-help="settings.it.wards"
                  onClick={() => setBedLabelsModal(undefined)}
                >
                  {t("Close", "بند کریں")}
                </button>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: "1rem",
                  maxHeight: "60vh",
                  overflowY: "auto",
                }}
              >
                {bedLabelsModal.data.labels.map((lbl) => (
                  <div
                    key={lbl.bed_id}
                    className="card"
                    style={{ textAlign: "center", padding: "0.5rem" }}
                  >
                    <strong>{lbl.label}</strong>
                    <div
                      style={{
                        width: "120px",
                        height: "120px",
                        margin: "0.5rem auto",
                      }}
                      dangerouslySetInnerHTML={{ __html: lbl.qr_svg }}
                    />
                    <code style={{ fontSize: "0.75rem" }}>{lbl.code}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}
