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
    [error, setError] = useState<unknown>();
  const write = useClinicalWrite(
    { user_id: userId, permissions },
    "it-wards",
    async () => {
      setDraft(undefined);
      setReview(undefined);
      await list.reload();
    },
  );
  if (!allowed) return null;
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
      <button
        data-help="settings.it.wards"
        disabled={write.blocked || !!draft}
        onClick={list.reload}
      >
        {t("Refresh wards", "وارڈ تازہ کریں")}
      </button>
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
    </section>
  );
}
