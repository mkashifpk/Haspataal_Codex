import { useRef, useState } from "react";
import { api, call } from "./bridge";
import { bilingual as t, tr } from "./i18n";
import {
  Details,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "./components";
import { type ClinicalUser } from "./clinical-context";
import { ClinicalWriteFeedback, useClinicalWrite } from "./clinical-write";
import { hospitalTimeToUtc, formatHospitalTime } from "./hospital-time";
import * as ref from "./generated/external_referral";
import { getPatient } from "./generated/patient_search";
export function ReferralRecord({
  id,
  user,
  revision,
  readOnly,
  connected,
  timeZone,
  onChanged,
  blocked = false,
  helpScreen = "external_referral",
}: {
  id: number;
  user: ClinicalUser;
  revision: number;
  readOnly: boolean;
  connected: boolean;
  timeZone?: string;
  onChanged?: () => void;
  blocked?: boolean;
  helpScreen?: string;
}) {
  const [local, setLocal] = useState(0),
    [action, setAction] = useState<"cancel" | "ack">(),
    [reason, setReason] = useState(""),
    [recipient, setRecipient] = useState(""),
    [when, setWhen] = useState(""),
    [note, setNote] = useState(""),
    [actual, setActual] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState<unknown>(),
    [notice, setNotice] = useState(""),
    [paperBusy, setPaperBusy] = useState(false);
  const paperFlight = useRef(false);
  const record = useLoad(() => ref.getReferrals(id), [id, revision, local]),
    value =
      record.data && !record.loading && !record.error ? record.data : undefined;
  const profile = useLoad(
    () =>
      record.data && user.permissions.includes("patient.view")
        ? getPatient(record.data.patient_id)
        : Promise.resolve(undefined),
    [record.data?.patient_id, revision, local],
  );
  const write = useClinicalWrite(user, `referral:${id}`, async () => {
    setAction(undefined);
    setDirty(false);
    setLocal((n) => n + 1);
    onChanged?.();
  });
  const allowed =
    user.permissions.includes("referral.create") &&
    !readOnly &&
    connected &&
    !blocked &&
    value?.status === "Issued";
  const reviewed = () => {
    const observed = write.observed as ref.ReferralOut | undefined;
    if (observed?.referral_id === id && observed.status !== "Issued") {
      setAction(undefined);
      setDirty(false);
    }
    setLocal((n) => n + 1);
    onChanged?.();
  };
  const time = (v: string | null) =>
    v
      ? timeZone
        ? formatHospitalTime(v, timeZone)
        : v
      : t("Not recorded", "درج نہیں");
  const close = () => {
    if (write.blocked) return;
    if (
      dirty &&
      !window.confirm(
        t(
          "Discard unsent referral action details?",
          "حوالے کے غیر ارسال عمل کی معلومات چھوڑ دیں؟",
        ),
      )
    )
      return;
    setAction(undefined);
    setDirty(false);
  };
  function submit() {
    setError(undefined);
    if (!value || !action || !allowed || write.blocked) return;
    try {
      const body =
        action === "cancel"
          ? { reason: reason.trim() }
          : {
              acknowledged_by_name: recipient.trim(),
              acknowledged_at: when
                ? hospitalTimeToUtc(when, timeZone || "")
                : null,
              note: note || null,
            };
      if (action === "cancel" && reason.trim().length < 3)
        throw new Error(
          t(
            "Enter a cancellation reason of at least 3 characters.",
            "منسوخی کی کم از کم3حروف کی وجہ لکھیں۔",
          ),
        );
      if (action === "ack" && (!actual || recipient.trim().length < 2))
        throw new Error(
          t(
            "Confirm the actual receiving facility acknowledgement and name who received the patient.",
            "وصول کنندہ مرکز کی اصل وصولی کی تصدیق اور مریض لینے والے کا نام لازم ہے۔",
          ),
        );
      write.start(
        {
          method: "POST",
          path: `/referrals/${id}/${action === "cancel" ? "cancel" : "acknowledge"}`,
          body,
          permission: "referral.create",
          protection: "reconcile",
          label:
            action === "cancel"
              ? t("Cancel referral", "حوالہ منسوخ کریں")
              : t("Record actual acknowledgement", "اصل وصولی درج کریں"),
          reconcilePath: `/referrals/${id}`,
        },
        async () => {
          const [now, me] = await Promise.all([
            ref.getReferrals(id),
            api<any>("GET", "/auth/me"),
          ]);
          if (
            now.referral_id !== id ||
            now.patient_id !== value.patient_id ||
            now.status !== "Issued" ||
            me.user_id !== user.user_id ||
            !me.permissions.includes("referral.create")
          )
            throw new Error(
              t(
                "This referral is closed or permission changed. Refresh and review.",
                "یہ حوالہ بند یا اجازت بدل گئی۔ تازہ کرکے چیک کریں۔",
              ),
            );
        },
      );
    } catch (e) {
      setError(e);
    }
  }
  async function letter(preview: boolean) {
    if (paperFlight.current || write.blocked || blocked) return;
    paperFlight.current = true;
    setPaperBusy(true);
    setError(undefined);
    setNotice("");
    try {
      const r = await call<{ opened?: boolean; saved?: boolean }>(
        "clinical-pdf",
        { path: `/referrals/${id}/pdf`, preview },
      );
      setNotice(
        r.saved
          ? t("Referral PDF saved.", "حوالہ پی ڈی ایف محفوظ ہوگئی۔")
          : r.opened
            ? t(
                "Letter opened in a separate PDF window. Use its Print control; verify the patient before handing it over.",
                "خط الگ پی ڈی ایف میں کھل گیا۔ پرنٹ بٹن استعمال اور دینے سے پہلے مریض چیک کریں۔",
              )
            : t(
                "Save cancelled; referral remains in the record.",
                "محفوظ کرنا منسوخ؛ حوالہ ریکارڈ میں ہے۔",
              ),
      );
    } catch (e) {
      setError(e);
    } finally {
      paperFlight.current = false;
      setPaperBusy(false);
    }
  }
  return (
    <section
      className="card"
      data-help-screen={helpScreen}
      data-write-pending={write.blocked ? "true" : "false"}
    >
      <LoadState {...record} retry={record.reload} />
      <LoadState {...profile} retry={profile.reload} />
      <ErrorBox error={action ? undefined : error} verbatim />
      <p role="status">{paperBusy ? t("Preparing referral PDF…", "حوالے کی پی ڈی ایف تیار ہو رہی ہے…") : notice}</p>
      {!action && <ClinicalWriteFeedback write={write} onReviewed={reviewed} />}
      {value && (
        <>
          <h2>
            <bdi>{value.referral_number}</bdi> · {tr(value.status)}
          </h2>
          <p>
            <strong>{value.patient_name}</strong> · <bdi>{value.mrn}</bdi> ·{" "}
            {value.age_years ?? t("Age not recorded", "عمر درج نہیں")} ·{" "}
            {tr(value.gender || "unknown")}
          </p>
          {profile.data && (
            <>
              <p>
                {t("Current allergies", "موجودہ الرجی")}:{" "}
                {profile.data.allergies || t("Not recorded", "درج نہیں")} ·{" "}
                {t("Blood group", "خون کا گروپ")}:{" "}
                {profile.data.blood_group || t("Not recorded", "درج نہیں")}
              </p>
              {profile.data.is_deceased && (
                <p className="error">
                  {t("Deceased patient", "وفات یافتہ مریض")}
                </p>
              )}
              {profile.data.temp_identifier && (
                <p>
                  {t("Temporary identity", "عارضی شناخت")}:{" "}
                  {profile.data.temp_identifier}
                </p>
              )}
              {profile.data.mlc_numbers.length > 0 && (
                <p>
                  {t("MEDICO-LEGAL", "میڈیکو لیگل")}:{" "}
                  {profile.data.mlc_numbers.join(", ")}
                </p>
              )}
              <details>
                <summary data-help="referral.record">
                  {t(
                    "Current outstanding dues / linked identities",
                    "موجودہ بقایا / منسلک شناخت",
                  )}
                </summary>
                <Details value={profile.data.outstanding} />
                {profile.data.merged_profiles.map((p) => (
                  <p key={p.patient_id}>{p.mrn}</p>
                ))}
              </details>
              {profile.data.patient_id !== value.patient_id && (
                <p className="notice">
                  {t(
                    "The current record is the merged master. This issued letter retains the original patient particulars.",
                    "موجودہ ریکارڈ ضم شدہ اصل ہے۔ جاری خط اصل وقت کی معلومات رکھتا ہے۔",
                  )}
                </p>
              )}
            </>
          )}
          <p>
            {t("To", "منزل")}: <strong>{value.destination_name}</strong> ·{" "}
            {value.destination_department} · {tr(value.urgency)}
          </p>
          <p>
            {t("Reason", "وجہ")}: {value.reason}
          </p>
          <h3>{t("Clinical summary", "طبی خلاصہ")}</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{value.clinical_summary}</p>
          <p>
            {t("Treatment given", "دیا ہوا علاج")}:{" "}
            {value.treatment_given || t("Not recorded", "درج نہیں")}
          </p>
          {value.at_patient_request && (
            <p>{t("At the patient’s request", "مریض کی درخواست پر")}</p>
          )}
          <p>
            {t("Transport", "نقل و حمل")}: {tr(value.transport)} ·{" "}
            {value.escort_name}
          </p>
          <p>
            {t("Care during transfer", "منتقلی کے دوران نگہداشت")}:{" "}
            {value.care_during_transfer || t("Not recorded", "درج نہیں")}
          </p>
          <p>
            {time(value.created_at)} · {value.referred_by_stamp.text}
          </p>
          {value.acknowledgement_pending && (
            <p className="notice" role="status">
              {t(
                "Acknowledgement pending — our staff took the patient; receiving facility acknowledgement is not recorded.",
                "وصولی کی تصدیق باقی — ہمارے عملے کی منتقلی پر مرکز کی وصولی درج نہیں۔",
              )}
            </p>
          )}
          {value.status === "Acknowledged" && (
            <p>
              {t("Acknowledged by", "وصول کرنے والا")}:{" "}
              {value.acknowledged_by_name} · {time(value.acknowledged_at)} ·{" "}
              {value.acknowledgement_note}
            </p>
          )}
          {value.status === "Cancelled" && (
            <p className="notice">
              {t("CANCELLED", "منسوخ")}: {value.cancel_reason} ·{" "}
              {time(value.cancelled_at)}
            </p>
          )}
          <button
            data-help="referral.print"
            disabled={write.blocked || blocked || paperBusy}
            onClick={() => void letter(true)}
          >
            {t("Open referral letter / print", "حوالے کا خط کھولیں / پرنٹ")}
          </button>
          <button
            data-help="referral.print"
            disabled={write.blocked || blocked || paperBusy}
            onClick={() => void letter(false)}
          >
            {t("Save referral letter PDF", "حوالے کا خط پی ڈی ایف محفوظ کریں")}
          </button>
          {allowed && (
            <>
              <button
                data-help="referral.ack"
                disabled={write.blocked}
                onClick={() => {
                  setAction("ack");
                  setRecipient("");
                  setWhen("");
                  setNote("");
                  setActual(false);
                  setDirty(false);
                }}
              >
                {t(
                  "Record receiving acknowledgement",
                  "مرکز کی وصولی درج کریں",
                )}
              </button>
              <button
                data-help="referral.cancel"
                disabled={write.blocked}
                onClick={() => {
                  setAction("cancel");
                  setReason("");
                  setDirty(false);
                }}
              >
                {t("Cancel referral", "حوالہ منسوخ کریں")}
              </button>
            </>
          )}
          {action && (
            <Modal
              title={
                action === "cancel"
                  ? t("Cancel referral", "حوالہ منسوخ کریں")
                  : t(
                      "Record actual receiving acknowledgement",
                      "مرکز کی اصل وصولی درج کریں",
                    )
              }
              onClose={close}
              closable={!write.blocked}
            >
              <p>
                {value.patient_name} ·{" "}
                <bdi>
                  {value.mrn} · {value.referral_number}
                </bdi>{" "}
                · {value.destination_name}
              </p>
              <section data-unsaved={dirty ? "true" : "false"}>
                <fieldset
                  disabled={write.blocked || !allowed}
                  onChange={() => setDirty(true)}
                >
                  {action === "cancel" ? (
                    <Field
                      label={t(
                        "Referral cancellation reason",
                        "حوالہ منسوخی کی وجہ",
                      )}
                    >
                      <textarea
                        data-help="referral.cancel"
                        value={reason}
                        maxLength={1000}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </Field>
                  ) : (
                    <>
                      <Field
                        label={t(
                          "Who received the patient",
                          "مریض وصول کرنے والا",
                        )}
                      >
                        <input
                          data-help="referral.ack"
                          value={recipient}
                          maxLength={200}
                          onChange={(e) => setRecipient(e.target.value)}
                        />
                      </Field>
                      <Field
                        label={t(
                          "Received at (hospital time; blank means now)",
                          "وصولی کا وقت (ہسپتال؛ خالی کا مطلب اب)",
                        )}
                      >
                        <input
                          data-help="referral.ack"
                          type="datetime-local"
                          value={when}
                          onChange={(e) => setWhen(e.target.value)}
                        />
                      </Field>
                      <Field label={t("Acknowledgement note", "وصولی کا نوٹ")}>
                        <textarea
                          data-help="referral.ack"
                          value={note}
                          maxLength={1000}
                          onChange={(e) => setNote(e.target.value)}
                        />
                      </Field>
                      <label>
                        <input
                          type="checkbox"
                          data-help="referral.ack"
                          checked={actual}
                          onChange={(e) => setActual(e.target.checked)}
                        />
                        {t(
                          "The receiving facility has actually acknowledged receipt of this patient.",
                          "وصول کنندہ مرکز نے واقعی اسی مریض کی وصولی تصدیق کی ہے۔",
                        )}
                      </label>
                    </>
                  )}
                  <button data-help="referral.action" onClick={submit}>
                    {t("Confirm referral action", "حوالے کے عمل کی تصدیق")}
                  </button>
                  <button data-help="referral.action" onClick={close}>
                    {t("Cancel", "منسوخ")}
                  </button>
                </fieldset>
                <ErrorBox error={error} verbatim />
                <ClinicalWriteFeedback write={write} onReviewed={reviewed} />
              </section>
            </Modal>
          )}
        </>
      )}
    </section>
  );
}
