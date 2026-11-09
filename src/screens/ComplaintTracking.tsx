import { useEffect, useState, type FormEvent } from "react";
import { byNumberComplaints } from "../generated/complaint_tracking";
import { Field, LoadState, useLoad } from "../components";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";

const statuses = {
  Received: "موصول",
  Acknowledged: "وصولی کا جواب",
  Resolved: "جواب پہنچایا",
  Appealed: "اپیل درج",
  Closed: "بند",
  Withdrawn: "واپس",
  NotMaintainable: "ناقابل کارروائی",
} as const;
const means = {
  InPerson: "بالمشافہ",
  Telephone: "ٹیلی فون",
  SMS: "پیغام",
  Letter: "خط",
  Email: "ای میل",
} as const;
export function ComplaintTracking({
  user,
  screenId,
  disabled,
  canWrite,
  onOpen,
  onPendingChange,
}: {
  user: ClinicalUser;
  screenId: string;
  disabled: boolean;
  canWrite: boolean;
  onOpen: (id: number) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [draft, setDraft] = useState(""),
    [number, setNumber] = useState(""),
    [matched, setMatched] = useState(false),
    [appeal, setAppeal] = useState(false),
    [reviewed, setReviewed] = useState(false);
  const permission = ["complaint.register", "complaint.manage"].find((p) =>
    user.permissions.includes(p),
  );
  const permitted = !!permission || user.permissions.includes("complaint.view");
  const lookup = useLoad(
    () =>
      number && permitted
        ? byNumberComplaints(encodeURIComponent(number))
        : Promise.resolve(undefined),
    [number, permitted],
  );
  const card =
    !lookup.loading &&
    !lookup.error &&
    lookup.data?.complaint_number.toUpperCase() === number
      ? lookup.data
      : undefined;
  const write = useClinicalWrite(user, screenId, async () => {
    setAppeal(false);
    setMatched(false);
    setReviewed(false);
    await lookup.reload();
  });
  useEffect(() => {
    onPendingChange(write.blocked);
  }, [write.blocked, onPendingChange]);
  if (!permitted) return null;
  function find(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || write.blocked || appeal) return;
    const value = draft.toUpperCase().replace(/\s+/g, "");
    if (!/^CMP-\d{4}-\d{5,}$/.test(value)) {
      const field = event.currentTarget.elements.namedItem(
        "tracking_number",
      ) as HTMLInputElement;
      field.setCustomValidity(
        t(
          "Enter the exact complaint tracking number.",
          "عین شکایت ٹریکنگ نمبر لکھیں۔",
        ),
      );
      field.reportValidity();
      return;
    }
    setMatched(false);
    setReviewed(false);
    write.clearError();
    if (value === number) void lookup.reload();
    else setNumber(value);
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !card?.can_appeal ||
      !matched ||
      !reviewed ||
      !permission ||
      !canWrite ||
      write.blocked
    )
      return;
    const f = new FormData(event.currentTarget),
      appeal_text = String(f.get("appeal_text") ?? "").trim();
    if (appeal_text.length < 10) return;
    const cardPath = `/complaints/by-number/${encodeURIComponent(number)}`;
    write.start(
      {
        method: "POST",
        path: `/complaints/${card.complaint_id}/appeal`,
        body: { appeal_text, means: f.get("means") },
        permission,
        protection: "idempotent",
        reconcilePath: cardPath,
        label: t("Record this appeal", "یہ اپیل درج کریں"),
      },
      async () => {
        const fresh = await byNumberComplaints(encodeURIComponent(number));
        if (
          fresh.complaint_id !== card.complaint_id ||
          !fresh.can_appeal ||
          fresh.complainant_name !== card.complainant_name
        ) {
          setMatched(false);
          await lookup.reload();
          throw Error(
            t(
              "The tracking card changed. Recheck the person and the appeal window.",
              "کارڈ بدل گیا۔ نام اور اپیل مدت دوبارہ چیک کریں۔",
            ),
          );
        }
      },
    );
  }
  return (
    <article
      className="card"
      data-unsaved={appeal}
      data-write-pending={write.blocked}
    >
      <h2>{t("Track a complaint", "شکایت معلوم کریں")}</h2>
      <p>
        {t(
          "Use the exact tracking number the person brings. Ask for their name before sharing the status.",
          "لایا ہوا عین ٹریکنگ نمبر دیں۔ حالت بتانے سے پہلے نام پوچھیں۔",
        )}
      </p>
      <form onSubmit={find}>
        <fieldset disabled={disabled || write.blocked || appeal}>
          <Field label={t("Complaint tracking number", "شکایت ٹریکنگ نمبر")}>
            <input
              data-help="ci.track-number"
              name="tracking_number"
              required
              autoComplete="off"
              spellCheck={false}
              maxLength={40}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setNumber("");
                setMatched(false);
                e.target.setCustomValidity("");
              }}
            />
          </Field>
          <button data-help="ci.track-number" type="submit">
            {t("Find tracking card", "ٹریکنگ کارڈ تلاش")}
          </button>
        </fieldset>
      </form>
      {number && <LoadState {...lookup} retry={() => void lookup.reload()} />}
      <ClinicalWriteFeedback
        write={write}
        onReviewed={() => {
          setAppeal(false);
          setMatched(false);
          void lookup.reload();
        }}
      />
      {card && (
        <section aria-label={t("Complaint tracking card", "شکایت ٹریکنگ کارڈ")}>
          <h3>{card.complaint_number}</h3>
          <p>
            {t("Name on card", "کارڈ پر نام")}: {card.complainant_name}
          </p>
          <label className="check">
            <input
              type="checkbox"
              data-help="ci.track-identity"
              checked={matched}
              disabled={disabled || write.blocked}
              onChange={(e) => {
                setMatched(e.target.checked);
                setReviewed(false);
                if (!e.target.checked) setAppeal(false);
              }}
            />
            {t(
              "I confirmed the name with the person at the desk.",
              "ڈیسک پر موجود شخص سے نام کی تصدیق کی۔",
            )}
          </label>
          {matched && (
            <>
              <dl className="details">
                <div>
                  <dt>{t("Status", "حالت")}</dt>
                  <dd>{t(card.status, statuses[card.status])}</dd>
                </div>
                <div>
                  <dt>{t("Contact person", "رابطے کا ذمہ دار")}</dt>
                  <dd>{card.contact_name ?? t("Not recorded", "درج نہیں")}</dd>
                </div>
                <div>
                  <dt>
                    {card.appeal_until
                      ? t("Appeal until", "اپیل کی آخری تاریخ")
                      : t("Answer due", "جواب کی تاریخ")}
                  </dt>
                  <dd>
                    {card.appeal_until ??
                      card.answer_due ??
                      t("Not recorded", "درج نہیں")}
                  </dd>
                </div>
              </dl>
              <div className="toolbar">
                {card.can_open && !appeal && (
                  <button
                    data-help="ci.track-open"
                    disabled={disabled || write.blocked}
                    onClick={() => onOpen(card.complaint_id)}
                  >
                    {t("Open permitted complaint", "مجاز شکایت کھولیں")}
                  </button>
                )}
                {card.can_appeal && canWrite && permission && !appeal && (
                  <button
                    data-help="ci.track-appeal"
                    disabled={write.blocked}
                    onClick={() => {
                      setAppeal(true);
                      setReviewed(false);
                    }}
                  >
                    {t(
                      "Record appeal from tracking card",
                      "ٹریکنگ کارڈ سے اپیل درج",
                    )}
                  </button>
                )}
              </div>
            </>
          )}
          {matched && appeal && (
            <form onSubmit={save} onChange={() => setReviewed(false)}>
              <fieldset
                disabled={!card.can_appeal || !canWrite || write.blocked}
              >
                <Field label={t("Why they disagree", "اختلاف کی وجہ")}>
                  <textarea
                    data-help="ci.track-appeal"
                    name="appeal_text"
                    minLength={10}
                    maxLength={8000}
                    required
                  />
                </Field>
                <Field label={t("How the appeal came", "اپیل کیسے آئی")}>
                  <select data-help="ci.track-appeal" name="means">
                    {Object.entries(means).map(([key, ur]) => (
                      <option key={key} value={key}>
                        {t(key, ur)}
                      </option>
                    ))}
                  </select>
                </Field>
                <label className="check">
                  <input
                    data-help="ci.track-appeal"
                    type="checkbox"
                    checked={reviewed}
                    onChange={(e) => {
                      e.stopPropagation();
                      setReviewed(e.target.checked);
                    }}
                  />
                  {t(
                    "I checked the person, appeal window and their words.",
                    "شخص، اپیل مدت اور اصل الفاظ چیک کیے۔",
                  )}
                </label>
                <button
                  type="submit"
                  data-help="ci.track-appeal"
                  disabled={!reviewed}
                >
                  {t("Save tracking appeal", "ٹریکنگ اپیل محفوظ")}
                </button>
              </fieldset>
              <button
                type="button"
                data-help="ci.cancel"
                disabled={write.blocked}
                onClick={() => setAppeal(false)}
              >
                {t("Cancel unsent appeal", "غیر ارسال اپیل منسوخ")}
              </button>
            </form>
          )}
        </section>
      )}
    </article>
  );
}
