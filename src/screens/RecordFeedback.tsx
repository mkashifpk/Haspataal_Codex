import { useEffect, useRef, useState, type FormEvent } from "react";
import * as api from "../generated/record_feedback_reception";
import { DirectoryPicker, canReadDirectory } from "../DirectoryPicker";
import { ErrorBox, Field } from "../components";
import { call } from "../bridge";
import { useClinicalWrite, ClinicalWriteFeedback } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";
import { hospitalTimeInput, hospitalTimeZoneError } from "../hospital-time";

type Reason = NonNullable<api.FeedbackIn["reasons"]>[number];
const yes: Reason[] = [
  "CompleteInformation",
  "AvailableWhenNeeded",
  "NotCostly",
  "ConvenientToReach",
  "CourteousStaff",
  "RelevantStaffAvailable",
  "PrivacyObserved",
  "FemaleStaffAvailable",
  "Recovered",
  "Other",
];
const no: Reason[] = [
  "Confidentiality",
  "Privacy",
  "LackOfAttention",
  "InadequateInformation",
  "AskedToComeAgain",
  "Costly",
  "LongWait",
  "DiscourteousStaff",
  "StaffNotCompetent",
  "RelevantStaffNotAvailable",
  "FemaleStaffNotAvailable",
  "SideEffects",
  "Other",
];
const wording: Record<string, [string, string]> = {
  CompleteInformation: [
    "Complete information provided",
    "مکمل معلومات فراہم ہوئیں",
  ],
  AvailableWhenNeeded: [
    "Services available when needed",
    "ضرورت پر خدمات دستیاب",
  ],
  NotCostly: ["Services are not costly", "خدمات مہنگی نہیں"],
  ConvenientToReach: [
    "Convenient to reach the facility",
    "ادارے تک پہنچنا آسان",
  ],
  CourteousStaff: ["Staff is courteous", "عملہ خوش اخلاق"],
  RelevantStaffAvailable: ["Relevant staff is available", "متعلقہ عملہ دستیاب"],
  PrivacyObserved: ["Privacy is observed", "پردے کا خیال رکھا گیا"],
  FemaleStaffAvailable: ["Female staff is available", "خاتون عملہ دستیاب"],
  Recovered: ["I recovered after treatment", "علاج سے صحت یاب ہوا"],
  Other: ["Other (specify)", "دیگر (وضاحت)"],
  Confidentiality: ["Issues of confidentiality", "معلومات کی رازداری کا مسئلہ"],
  Privacy: ["Issues of privacy", "پردے کا مسئلہ"],
  LackOfAttention: ["Lack of attention", "توجہ کی کمی"],
  InadequateInformation: ["Inadequate information provided", "ناکافی معلومات"],
  AskedToComeAgain: [
    "I was asked to come another time",
    "دوبارہ آنے کو کہا گیا",
  ],
  Costly: ["Medicines/services are costly", "ادویات یا خدمات مہنگی"],
  LongWait: ["Waiting time is too long", "انتظار بہت طویل"],
  DiscourteousStaff: [
    "Staff is discourteous / unsatisfactory behaviour",
    "عملے کی بد اخلاقی یا غیر تسلی بخش رویہ",
  ],
  StaffNotCompetent: ["Staff is not competent", "عملہ اہل نہیں"],
  RelevantStaffNotAvailable: [
    "Relevant staff not available",
    "متعلقہ عملہ دستیاب نہیں",
  ],
  FemaleStaffNotAvailable: [
    "Female staff not available (gender issue)",
    "خاتون عملہ دستیاب نہیں",
  ],
  SideEffects: [
    "I suffered from side effects of the treatment",
    "علاج کے مضر اثرات ہوئے",
  ],
  ExitInterview: ["Exit interview", "رخصتی پر رائے"],
  Form: ["Paper form / suggestion box", "کاغذی فارم یا تجویز کا ڈبہ"],
  KeyInformant: ["Community key informant", "برادری کا باخبر فرد"],
  Patient: ["Patient", "مریض"],
  Relative: ["Relative", "رشتہ دار"],
  Anonymous: ["Anonymous", "گمنام"],
  CommunityMember: ["Community member", "برادری کا فرد"],
};
export const feedbackLabel = (v: string) => (wording[v] ? t(...wording[v]) : v);
const label = feedbackLabel;
export function RecordFeedback({
  user,
  connected,
  readOnly,
  noNewWork,
  timeZone,
  onOpenHelp,
}: {
  user: ClinicalUser;
  connected: boolean;
  readOnly: boolean;
  noNewWork: boolean;
  timeZone?: string;
  onOpenHelp: () => void;
}) {
  const [open, setOpen] = useState(false),
    [dirty, setDirty] = useState(false),
    [saved, setSaved] = useState<api.FeedbackDetailOut>(),
    [answer, setAnswer] = useState(""),
    [reasons, setReasons] = useState<Reason[]>([]),
    [other, setOther] = useState(""),
    [respondent, setRespondent] =
      useState<api.FeedbackIn["respondent"]>("Anonymous"),
    [consent, setConsent] = useState(false),
    [reference, setReference] = useState("patient"),
    [id, setId] = useState(""),
    [visits, setVisits] =
      useState<
        { ticket_id: number; ticket_number: string; patient_name: string }[]
      >(),
    [busy, setBusy] = useState(false),
    [directoryError, setDirectoryError] = useState<unknown>(),
    [formError, setFormError] = useState<unknown>(),
    [reviewed, setReviewed] = useState(false),
    [paperBusy, setPaperBusy] = useState(false),
    [paperError, setPaperError] = useState<unknown>(),
    [paperNotice, setPaperNotice] = useState("");
  const generation = useRef(0);
  const permission = ["feedback.record", "feedback.review"].find((p) =>
      user.permissions.includes(p),
    ),
    allowed = !!permission;
  const zoneError = hospitalTimeZoneError(timeZone),
    today = !zoneError
      ? hospitalTimeInput(Date.now(), timeZone!).slice(0, 10)
      : "";
  const write = useClinicalWrite(
    user,
    "record_feedback_reception",
    async (value: api.FeedbackDetailOut) => {
      setSaved(value);
      setOpen(false);
      setDirty(false);
      setReviewed(false);
    },
  );
  const blocked =
    write.blocked ||
    !connected ||
    readOnly ||
    noNewWork ||
    !allowed ||
    !!zoneError;
  useEffect(
    () => () => {
      ++generation.current;
    },
    [],
  );
  async function loadVisits() {
    const n = ++generation.current;
    setBusy(true);
    setVisits(undefined);
    setDirectoryError(undefined);
    setId("");
    setReviewed(false);
    try {
      const d = await api.receptionDashboard();
      const rows = [
        ...d.queues.flatMap((q) => q.entries),
        ...d.deferred,
        ...d.awaiting_approval,
      ];
      if (n === generation.current)
        setVisits([...new Map(rows.map((r) => [r.ticket_id, r])).values()]);
    } catch (e) {
      if (n === generation.current) setDirectoryError(e);
    } finally {
      if (n === generation.current) setBusy(false);
    }
  }
  function start() {
    if (blocked) return;
    setOpen(true);
    setSaved(undefined);
    setAnswer("");
    setReasons([]);
    setOther("");
    setRespondent("Anonymous");
    setConsent(false);
    setId("");
    setReference("patient");
    setVisits(undefined);
    setDirectoryError(undefined);
    setFormError(undefined);
    setPaperNotice("");
    setPaperError(undefined);
    setReviewed(false);
    setDirty(false);
    write.clearError();
  }
  function cancel() {
    if (write.blocked) return;
    if (
      dirty &&
      !window.confirm(
        t("Discard this unsent feedback form?", "یہ غیر ارسال رائے ختم کریں؟"),
      )
    )
      return;
    setOpen(false);
    setDirty(false);
    setReviewed(false);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (blocked || busy || !reviewed || !answer) return;
    setFormError(undefined);
    const f = new FormData(e.currentTarget),
      body: api.FeedbackIn = {
        channel: String(f.get("channel")) as api.FeedbackIn["channel"],
        respondent,
        satisfied: answer === "yes",
        reasons,
        received_on: String(f.get("received_on")),
        comments: String(f.get("comments") || "").trim() || null,
        other_reason: reasons.includes("Other") ? other.trim() : null,
      };
    if (consent && respondent !== "Anonymous") {
      if (!id) {
        setFormError(
          new Error(
            t(
              "Choose the agreed patient or visit by name first.",
              "پہلے رضامندی والا مریض یا پرچی نام سے چنیں۔",
            ),
          ),
        );
        return;
      }
      if (reference === "visit") body.ticket_id = Number(id);
      else body.patient_id = Number(id);
    }
    await write.start({
      method: "POST",
      path: "/patient-feedback",
      body,
      permission: permission!,
      protection: "idempotent",
      reconcilePath: "/patient-feedback",
      label: t("Record this final feedback", "یہ حتمی رائے درج کریں"),
    });
  }
  async function paper(preview: boolean) {
    if (paperBusy || write.blocked || !connected || !allowed) return;
    setPaperBusy(true);
    setPaperError(undefined);
    setPaperNotice("");
    try {
      const r = await call("clinical-pdf", {
        path: "/patient-feedback/form/pdf",
        preview,
      });
      setPaperNotice(
        preview
          ? t("Blank feedback form opened.", "خالی رائے فارم کھلا۔")
          : r.saved
            ? t("Blank feedback form saved.", "خالی رائے فارم محفوظ۔")
            : t(
                "PDF save cancelled; no response was recorded.",
                "پی ڈی ایف محفوظ منسوخ؛ کوئی رائے درج نہیں ہوئی۔",
              ),
      );
    } catch (e) {
      setPaperError(e);
    } finally {
      setPaperBusy(false);
    }
  }
  return (
    <section
      data-screen="record_feedback_reception"
      data-unsaved={open && dirty}
      data-write-pending={write.blocked}
    >
      <header className="screen-heading">
        <div>
          <h1>{t("Record patient feedback", "مریض کی رائے درج کریں")}</h1>
          <p>
            {t(
              "Record the respondent’s own words. Anonymous unless they agree to a named reference. A saved response is final.",
              "جواب دینے والے کے اصل الفاظ درج کریں۔ نام کی رضامندی کے بغیر گمنام۔ محفوظ رائے حتمی ہے۔",
            )}
          </p>
        </div>
        <button data-help="fb.help" onClick={onOpenHelp}>
          {t("Help", "مدد")}
        </button>
      </header>
      <div className="toolbar">
        {allowed && (
          <>
            <button
              data-help="fb.new"
              disabled={blocked || open}
              onClick={start}
            >
              {t("New feedback response", "نئی رائے")}
            </button>
            <button
              data-help="fb.pdf"
              disabled={!connected || write.blocked || paperBusy}
              onClick={() => void paper(true)}
            >
              {t("Preview blank feedback form", "خالی رائے فارم دیکھیں")}
            </button>
            <button
              data-help="fb.pdf"
              disabled={!connected || write.blocked || paperBusy}
              onClick={() => void paper(false)}
            >
              {t("Save blank feedback form", "خالی رائے فارم محفوظ")}
            </button>
          </>
        )}
      </div>
      {!allowed && (
        <p role="status">
          {t(
            "You do not have permission to record feedback or obtain its form.",
            "آپ کو رائے یا اس کا فارم لینے کی اجازت نہیں۔",
          )}
        </p>
      )}
      {(readOnly || noNewWork) && (
        <p role="status">
          {t(
            "New feedback is unavailable in this server view.",
            "سرور کے اس منظر میں نئی رائے دستیاب نہیں۔",
          )}
        </p>
      )}
      <ErrorBox error={zoneError} />
      <ErrorBox error={paperError} />
      {paperNotice && <p role="status">{paperNotice}</p>}
      <ClinicalWriteFeedback
        write={{ ...write, notice: saved ? write.notice : "" }}
        onReviewed={() => {
          setOpen(false);
          setDirty(false);
          setReviewed(false);
        }}
      />
      {saved && (
        <article
          className="card"
          aria-label={t("Saved feedback response", "محفوظ رائے")}
        >
          <h2>{saved.feedback_number}</h2>
          <p>
            {t(
              "Recorded permanently; this response cannot be edited or deleted.",
              "مستقل درج؛ رائے تبدیل یا حذف نہیں ہو سکتی۔",
            )}
          </p>
          <dl>
            <dt>{t("Received on", "موصول تاریخ")}</dt>
            <dd>{saved.received_on}</dd>
            <dt>{t("Respondent", "رائے دینے والا")}</dt>
            <dd>{label(saved.respondent)}</dd>
            <dt>{t("Patient", "مریض")}</dt>
            <dd>
              {saved.patient_name ?? t("Not named", "نام نہیں دیا")}
              {saved.mrn ? " · " + saved.mrn : ""}
            </dd>
            <dt>{t("Satisfied", "مطمئن")}</dt>
            <dd>{saved.satisfied ? t("Yes", "ہاں") : t("No", "نہیں")}</dd>
            <dt>{t("Reasons", "وجوہ")}</dt>
            <dd>
              {saved.reasons.map(label).join(" · ") ||
                t("None given", "نہیں بتائی")}
              {saved.other_reason ? " · " + saved.other_reason : ""}
            </dd>
            <dt>{t("Comments", "تبصرہ")}</dt>
            <dd>{saved.comments ?? t("Not recorded", "درج نہیں")}</dd>
            <dt>{t("Recorded by", "درج کرنے والا")}</dt>
            <dd>{saved.recorded_by_name}</dd>
          </dl>
          {!saved.satisfied && (
            <p>
              {t(
                "The person in charge is notified by the server to review this dissatisfied response.",
                "سرور غیر مطمئن رائے کے جائزے کی اطلاع انچارج کو دیتا ہے۔",
              )}
            </p>
          )}
        </article>
      )}
      {!open && !saved && allowed && (
        <p>
          {t(
            "Start a new response or print blank forms for the suggestion box. Reception records feedback here; the person in charge reviews it.",
            "نئی رائے شروع کریں یا تجویز کے ڈبے کے خالی فارم لیں۔ استقبالیہ درج اور انچارج جائزہ لیتا ہے۔",
          )}
        </p>
      )}
      {open && (
        <form
          className="card"
          onSubmit={submit}
          onChange={() => {
            setDirty(true);
            setReviewed(false);
          }}
        >
          <h2>
            {t(
              "Client satisfaction form — Annex A",
              "خدمات سے اطمینان فارم — ضمیمہ الف",
            )}
          </h2>
          <ErrorBox error={formError} />
          <fieldset disabled={blocked}>
            <Field label={t("How received", "رائے کیسے ملی")}>
              <select name="channel" data-help="fb.channel">
                <option value="ExitInterview">{label("ExitInterview")}</option>
                <option value="Form">{label("Form")}</option>
                <option value="KeyInformant">{label("KeyInformant")}</option>
              </select>
            </Field>
            <Field label={t("Respondent", "رائے دینے والا")}>
              <select
                name="respondent"
                data-help="fb.respondent"
                value={respondent}
                onChange={(e) => {
                  setRespondent(e.target.value as api.FeedbackIn["respondent"]);
                  setConsent(false);
                  setId("");
                  ++generation.current;
                  setBusy(false);
                  setVisits(undefined);
                  setDirectoryError(undefined);
                }}
              >
                {["Anonymous", "Patient", "Relative", "CommunityMember"].map(
                  (v) => (
                    <option key={v} value={v}>
                      {label(v)}
                    </option>
                  ),
                )}
              </select>
            </Field>
            <Field label={t("Received on", "موصول تاریخ")}>
              <input
                type="date"
                name="received_on"
                data-help="fb.date"
                required
                defaultValue={today}
                max={today}
              />
            </Field>
            <Field
              label={t(
                "Are you satisfied with the services?",
                "کیا آپ خدمات سے مطمئن ہیں؟",
              )}
            >
              <select
                name="satisfied"
                data-help="fb.satisfied"
                required
                value={answer}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  setReasons([]);
                  setOther("");
                }}
              >
                <option value="">
                  {t(
                    "Choose the respondent’s answer",
                    "جواب دینے والے کا جواب چنیں",
                  )}
                </option>
                <option value="yes">{t("Yes", "ہاں")}</option>
                <option value="no">{t("No", "نہیں")}</option>
              </select>
            </Field>
            {answer && (
              <fieldset>
                <legend>
                  {answer === "yes"
                    ? t(
                        "If yes, how? Choose all given reasons.",
                        "ہاں تو کیسے؟ بتائی تمام وجوہ چنیں۔",
                      )
                    : t(
                        "If no, why? Choose all given reasons.",
                        "نہیں تو کیوں؟ بتائی تمام وجوہ چنیں۔",
                      )}
                </legend>
                {(answer === "yes" ? yes : no).map((v) => (
                  <label className="check" key={v}>
                    <input
                      type="checkbox"
                      name="reasons"
                      data-help="fb.reasons"
                      value={v}
                      checked={reasons.includes(v)}
                      onChange={(e) => {
                        setReasons((a) =>
                          e.target.checked
                            ? [...a, v]
                            : a.filter((r) => r !== v),
                        );
                        if (v === "Other" && !e.target.checked) setOther("");
                      }}
                    />
                    {label(v)}
                  </label>
                ))}
              </fieldset>
            )}
            {reasons.includes("Other") && (
              <Field
                label={t(
                  "Other reason — respondent’s words",
                  "دیگر وجہ — اصل الفاظ",
                )}
              >
                <textarea
                  name="other_reason"
                  data-help="fb.other"
                  required
                  maxLength={500}
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                />
              </Field>
            )}
            <Field label={t("Comments", "تبصرہ")}>
              <textarea
                name="comments"
                data-help="fb.comments"
                maxLength={2000}
              />
            </Field>
            <label className="check">
              <input
                type="checkbox"
                name="name_agreed"
                data-help="fb.consent"
                disabled={respondent === "Anonymous" || blocked}
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  setId("");
                  ++generation.current;
                  setBusy(false);
                  setVisits(undefined);
                  setDirectoryError(undefined);
                }}
              />
              {t(
                "The respondent agrees to name the patient or visit",
                "رائے دینے والا مریض یا پرچی کا نام دینے پر راضی ہے",
              )}
            </label>
            {consent && respondent !== "Anonymous" && (
              <>
                <Field label={t("Agreed reference", "رضامندی والا حوالہ")}>
                  <select
                    data-help="fb.reference"
                    value={reference}
                    onChange={(e) => {
                      setReference(e.target.value);
                      setId("");
                      ++generation.current;
                      setBusy(false);
                      setVisits(undefined);
                      setDirectoryError(undefined);
                    }}
                  >
                    <option value="patient">
                      {t("Patient by name", "مریض نام سے")}
                    </option>
                    <option value="visit">
                      {t(
                        "Visit from today’s reception queues",
                        "آج کے استقبالیہ قطار کی پرچی",
                      )}
                    </option>
                  </select>
                </Field>
                {reference === "patient" ? (
                  canReadDirectory("/patients/search", user.permissions) ? (
                    <Field label={t("Patient by name", "مریض نام سے")}>
                      <DirectoryPicker
                        data-help="fb.patient"
                        name="patient_id"
                        path="/patients/search"
                        idField="patient_id"
                        search
                        required
                        value={id}
                        onChange={(e) => setId(e.target.value)}
                      />
                    </Field>
                  ) : (
                    <p>
                      {t(
                        "Patient lookup is not permitted. Leave the response unnamed or ask Reception.",
                        "مریض تلاش کی اجازت نہیں۔ نام نہ دیں یا استقبالیہ سے پوچھیں۔",
                      )}
                    </p>
                  )
                ) : canReadDirectory(
                    "/opd-queues/reception-dashboard",
                    user.permissions,
                  ) ? (
                  <>
                    <button
                      type="button"
                      data-help="fb.visits"
                      disabled={busy}
                      onClick={() => void loadVisits()}
                    >
                      {busy
                        ? t("Loading visits…", "پرچیاں کھل رہی ہیں…")
                        : t(
                            "Load today’s reception visits",
                            "آج کی استقبالیہ پرچیاں کھولیں",
                          )}
                    </button>
                    <ErrorBox error={directoryError} />
                    <Field label={t("Agreed visit", "رضامندی والی پرچی")}>
                      <select
                        data-help="fb.visits"
                        name="ticket_id"
                        required
                        disabled={busy || !visits}
                        value={id}
                        onChange={(e) => setId(e.target.value)}
                      >
                        <option value="">
                          {t(
                            "Choose the patient and visit",
                            "مریض اور پرچی چنیں",
                          )}
                        </option>
                        {visits?.map((v) => (
                          <option key={v.ticket_id} value={v.ticket_id}>
                            {v.patient_name + " · " + v.ticket_number}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {visits?.length === 0 && (
                      <p role="status">
                        {t(
                          "No visit is in today’s reception queues. Choose the agreed patient by name or leave the response unnamed. Reception handles visits.",
                          "آج قطار میں پرچی نہیں۔ رضامندی والا مریض نام سے یا گمنام رکھیں۔ پرچیاں استقبالیہ دیکھتا ہے۔",
                        )}
                      </p>
                    )}
                  </>
                ) : (
                  <p>
                    {t(
                      "Reception queues are not permitted. Use an allowed patient lookup or leave the response unnamed.",
                      "قطار دیکھنے کی اجازت نہیں۔ مجاز مریض تلاش یا گمنام رکھیں۔",
                    )}
                  </p>
                )}
              </>
            )}
          </fieldset>
          <label className="check">
            <input
              type="checkbox"
              data-help="fb.review"
              disabled={blocked || busy}
              checked={reviewed}
              onChange={(e) => {
                e.stopPropagation();
                setReviewed(e.target.checked);
              }}
            />
            {t(
              "I checked the respondent’s answer, reasons, date and agreement. Saving is final.",
              "جواب، وجوہ، تاریخ اور رضامندی چیک کی۔ محفوظ کرنا حتمی ہے۔",
            )}
          </label>
          <div className="toolbar">
            <button
              data-help="fb.submit"
              type="submit"
              disabled={blocked || busy || !reviewed || !answer}
            >
              {t("Record final feedback", "حتمی رائے درج کریں")}
            </button>
            <button
              data-help="fb.cancel"
              type="button"
              disabled={write.blocked}
              onClick={cancel}
            >
              {t("Cancel unsent response", "غیر ارسال رائے منسوخ")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
