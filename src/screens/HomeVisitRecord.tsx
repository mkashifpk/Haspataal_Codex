import { useState } from "react";
import { api, call, getWithClock } from "../bridge";
import { bilingual as t, tr } from "../i18n";
import { Empty, ErrorBox, Field, LoadState, useLoad } from "../components";
import { ClinicalPatient, type PatientContext } from "../clinical-patient";
import {
  mayChangeClinicalContext,
  type ClinicalUser,
} from "../clinical-context";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import {
  hospitalTimeToUtc,
  formatHospitalTime,
  hospitalTimeInput,
} from "../hospital-time";
import { homeVisitIssues, homeVisitDateRange } from "../home-visit-rules";
import type { EstablishmentOut } from "../generated/facility_profile";
import * as home from "../generated/home_visit_record";
import { registerHomeVisits } from "../generated/home_visit_history";
type Props = {
  user: ClinicalUser;
  revision: number;
  initialTicket?: number;
  readOnly: boolean;
  connected: boolean;
  timeZone?: string;
  establishment?: EstablishmentOut;
};
type Draft = Omit<home.HomeVisitIn, "patient_id">;
function homeVisitIssueText(issue: string): string {
  const ur: Record<string, string> = {
    "Enter valid request and visit times using the hospital timezone and a current server clock.":
      "ہسپتال کے علاقے اور تازہ سرور وقت کے مطابق درست درخواست اور دورے کے وقت لکھیں۔",
    "The visit cannot be in the future.":
      "دورے کا وقت مستقبل میں نہیں ہو سکتا۔",
    "The visit cannot be before the request.":
      "دورہ درخواست سے پہلے نہیں ہو سکتا۔",
    "Deliberately choose examination consent.":
      "معائنے کی رضامندی کا واضح انتخاب کریں۔",
    "Examination findings require verbal consent.":
      "معائنے کے نتائج کو زبانی رضامندی لازم ہے۔",
    "Choose the actual outcome.": "اصل نتیجہ چنیں۔",
    "For a referral, say where the patient was referred.":
      "حوالے کے لیے اصل منزل بتائیں۔",
  };
  const fields: Record<string, [string, string]> = {
    requested_by: ["Requested by / relationship", "درخواست کنندہ / رشتہ"],
    reason: ["Reason for the visit", "دورے کی وجہ"],
    address: ["Address actually visited", "اصل دورے کا پتہ"],
    history: ["Patient / family history", "مریض / خاندان کی تاریخ"],
    assessment: ["Assessment / provisional diagnosis", "تشخیص / ابتدائی رائے"],
    care_given: ["Care actually given", "اصل دی گئی نگہداشت"],
  };
  const match = /^(\w+): enter (\d+)–(\d+) characters\.$/.exec(issue);
  if (match && fields[match[1]])
    return t(
      `${fields[match[1]][0]}: enter ${match[2]}–${match[3]} characters.`,
      `${fields[match[1]][1]}: ${match[2]}تا${match[3]}حروف لکھیں۔`,
    );
  return t(issue, ur[issue] || issue);
}
const blank = (): Draft => ({
  requested_by: "",
  requested_at: "",
  reason: "",
  address: "",
  visited_at: "",
  accompanied_by: "",
  examination_consent: "" as Draft["examination_consent"],
  history: "",
  examination: "",
  assessment: "",
  care_given: "",
  outcome: "" as Draft["outcome"],
  referred_to: "",
  follow_up: "",
});
export function HomeVisitRecord(props: Props) {
  const policy = useLoad(() => home.policy(), [props.revision]);
  const [error, setError] = useState<unknown>(),
    [printing, setPrinting] = useState(false);
  async function notice() {
    if (printing) return;
    setPrinting(true);
    setError(undefined);
    try {
      await call("clinical-pdf", {
        path: "/home-visits/notice/pdf",
        preview: true,
      });
    } catch (e) {
      setError(e);
    } finally {
      setPrinting(false);
    }
  }
  return (
    <section className="home-visit-screen">
      <h1>{t("Record a home visit", "گھر کے دورے کا اندراج")}</h1>
      <section className="card">
        <h2>{t("Home-visit policy", "گھر کے دورے کی پالیسی")}</h2>
        <LoadState {...policy} retry={policy.reload} />
        {policy.data && (
          <>
            <p>
              {tr(policy.data.state)} ·{" "}
              {policy.data.provided
                ? t("Home visits are provided.", "گھر کے دورے فراہم ہیں۔")
                : t("Home visits are not provided.", "گھر کے دورے فراہم نہیں۔")}
            </p>
            <p style={{ whiteSpace: "pre-wrap" }}>{policy.data.notice}</p>
            <p style={{ whiteSpace: "pre-wrap" }}>
              {policy.data.arrangements ||
                t("No arrangements recorded.", "انتظام درج نہیں۔")}
            </p>
          </>
        )}
        <button
          data-help="home.policy"
          disabled={printing || !props.connected || !policy.data}
          onClick={() => void policy.reload()}
        >
          {t("Refresh home-visit policy", "دورے کی پالیسی تازہ کریں")}
        </button>
        {props.user.permissions.some((p) =>
          ["homevisit.view", "msds.view"].includes(p),
        ) && (
          <button
            data-help="home.notice"
            disabled={printing || !props.connected}
            onClick={() => void notice()}
          >
            {t(
              "Open official home-visit notice PDF",
              "دورے کا اصل اطلاع پی ڈی ایف کھولیں",
            )}
          </button>
        )}
        <ErrorBox error={error} verbatim />
      </section>
      {(!policy.data?.provided || policy.data.state !== "Active") && (
        <p className="notice">
          {t(
            "No new home-visit records from now on while this service is inactive or retiring. Authorized history and the current public notice remain available. Ask facility staff about service arrangements.",
            "غیر فعال یا بند ہوتی خدمت میں اب نئے دورے درج نہیں۔ مجاز تاریخ اور اصل اطلاع دستیاب ہیں۔ انتظام کے لیے مجاز عملے سے رابطہ کریں۔",
          )}
        </p>
      )}
      <ClinicalPatient
        user={props.user}
        revision={props.revision}
        initialTicket={props.initialTicket}
      >
        {(ctx) => (
          <VisitForm
            {...props}
            ctx={ctx}
            policy={!policy.loading && !policy.error ? policy.data : undefined}
          />
        )}
      </ClinicalPatient>
    </section>
  );
}
function VisitForm({
  ctx,
  user,
  revision,
  readOnly,
  connected,
  timeZone,
  establishment,
  policy,
}: Props & { ctx: PatientContext; policy?: home.HomeVisitPolicyOut }) {
  const [draft, setDraft] = useState<Draft>(blank),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState<unknown>(),
    [saved, setSaved] = useState<home.HomeVisitOut>(),
    [correction, setCorrection] = useState<number>(),
    [local, setLocal] = useState(0);
  const canRead = user.permissions.some((p) =>
    ["homevisit.view", "msds.view"].includes(p),
  );
  const canRecord =
    user.permissions.includes("homevisit.record") &&
    policy?.provided &&
    policy.state === "Active" &&
    establishment?.active.includes("home_visits") &&
    !readOnly;
  const write = useClinicalWrite(
    user,
    `home:${ctx.patient.patient_id}`,
    async (value: home.HomeVisitOut) => {
      setSaved(value);
      setDraft(blank());
      setDirty(false);
      setCorrection(undefined);
      setLocal((n) => n + 1);
      await ctx.reload();
    },
  );
  const disabled =
    write.blocked ||
    !connected ||
    !ctx.ready ||
    !!ctx.patient.merged_into_id ||
    !canRecord;
  function edit<K extends keyof Draft>(k: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [k]: value }));
    setDirty(true);
  }
  function consent(value: Draft["examination_consent"]) {
    if (
      value !== draft.examination_consent &&
      draft.examination?.trim() &&
      value !== "VerbalObtained" &&
      !window.confirm(
        t(
          "Changing consent clears the unsaved examination findings. Continue?",
          "رضامندی بدلنے سے غیر محفوظ معائنہ صاف ہوگا۔ جاری رکھیں؟",
        ),
      )
    )
      return;
    setDraft((d) => ({
      ...d,
      examination_consent: value,
      examination: value === "VerbalObtained" ? d.examination : "",
    }));
    setDirty(true);
  }
  function newDraft() {
    if (!mayChangeClinicalContext()) return;
    setDraft(blank());
    setCorrection(undefined);
    setDirty(false);
    setError(undefined);
  }
  function correct(r: home.HomeVisitOut) {
    if (!canRecord || !timeZone || !mayChangeClinicalContext()) return;
    const {
      home_visit_id,
      visit_number,
      patient_id,
      mrn,
      patient_name,
      visited_by,
      author_stamp,
      created_at,
      ...fields
    } = r;
    setDraft({
      ...fields,
      requested_at: hospitalTimeInput(r.requested_at, timeZone),
      visited_at: hospitalTimeInput(r.visited_at, timeZone),
      follow_up: t(
        `Correction to home visit #${home_visit_id} (${visit_number}): explain the correction here.`,
        `گھر کے دورے #${home_visit_id} (${visit_number}) کی تصحیح: یہاں تبدیلی کی وجہ لکھیں۔`,
      ),
    });
    setCorrection(r.home_visit_id);
    setDirty(true);
    setError(undefined);
  }
  function submit() {
    setError(undefined);
    try {
      if (disabled || !timeZone)
        throw new Error(
          t(
            "Current permission, active service, patient identity, connection and hospital timezone are required.",
            "موجودہ اجازت، فعال خدمت، مریض، رابطہ اور ہسپتال وقت لازم ہیں۔",
          ),
        );
      const body: home.HomeVisitIn = {
        ...draft,
        patient_id: ctx.patient.patient_id,
        requested_at: hospitalTimeToUtc(draft.requested_at, timeZone),
        visited_at: hospitalTimeToUtc(draft.visited_at, timeZone),
        examination:
          draft.examination_consent === "VerbalObtained"
            ? draft.examination?.trim() || null
            : null,
        referred_to:
          draft.outcome === "Referred"
            ? draft.referred_to?.trim() || null
            : null,
      };
      if (
        correction &&
        (!draft.follow_up?.includes(`#${correction}`) ||
          draft.follow_up.includes("explain the correction here.") ||
          draft.follow_up.includes("یہاں تبدیلی کی وجہ لکھیں۔"))
      )
        throw new Error(
          t(
            "Keep the original #reference and explain the actual correction in Follow-up.",
            "اصل #حوالہ رکھیں اور فالو اپ میں اصل تصحیح بتائیں۔",
          ),
        );
      write.start(
        {
          method: "POST",
          path: "/home-visits",
          body,
          permission: "homevisit.record",
          protection: "idempotent",
          label: t("Record completed home visit", "مکمل دورہ درج کریں"),
        },
        async () => {
          const [fresh, est, pat] = await Promise.all([
            getWithClock<home.HomeVisitPolicyOut>("/home-visits/policy"),
            api<EstablishmentOut>("GET", "/establishment"),
            api<typeof ctx.patient>(
              "GET",
              `/patients/${ctx.patient.patient_id}`,
            ),
          ]);
          if (
            !fresh.data.provided ||
            fresh.data.state !== "Active" ||
            !est.active.includes("home_visits") ||
            pat.patient_id !== body.patient_id ||
            pat.merged_into_id
          )
            throw new Error(
              t(
                "Service or patient identity changed. Refresh before a new record.",
                "خدمت یا شناخت بدل گئی۔ نئے اندراج سے پہلے تازہ کریں۔",
              ),
            );
          const issues = homeVisitIssues(body, Date.parse(fresh.now));
          if (issues.length)
            throw new Error(
              t(
                "Check these facts before saving: ",
                "محفوظ سے پہلے یہ حقائق چیک کریں: ",
              ) + issues.map(homeVisitIssueText).join("\n"),
            );
          if (
            !window.confirm(
              t(
                `Record the completed home visit for ${ctx.patient.full_name}, ${ctx.patient.mrn}? This signed entry cannot be edited or deleted.`,
                `${ctx.patient.full_name}، ${ctx.patient.mrn} کا مکمل دورہ درج کریں؟ دستخط شدہ ریکارڈ تبدیل یا حذف نہیں ہوگا۔`,
              ),
            )
          )
            throw new Error(
              t(
                "Confirmation cancelled. No home-visit record was submitted.",
                "تصدیق منسوخ۔ دورے کا کوئی ریکارڈ ارسال نہیں ہوا۔",
              ),
            );
        },
      );
    } catch (e) {
      setError(e);
    }
  }
  const controls: [keyof Draft, string, string, number, boolean][] = [
    [
      "requested_by",
      "Requested by / relationship",
      "درخواست کنندہ / رشتہ",
      200,
      false,
    ],
    ["reason", "Reason for the visit", "دورے کی وجہ", 1000, true],
    ["address", "Address actually visited", "اصل دورے کا پتہ", 500, true],
    [
      "accompanied_by",
      "Accompanied by (optional)",
      "ساتھ جانے والا (اختیاری)",
      200,
      false,
    ],
    [
      "history",
      "Patient / family history",
      "مریض / خاندان کی بتائی تاریخ",
      4000,
      true,
    ],
    [
      "assessment",
      "Assessment / provisional diagnosis",
      "تشخیص / ابتدائی رائے",
      2000,
      true,
    ],
    ["care_given", "Care actually given", "اصل دی گئی نگہداشت", 4000, true],
    [
      "follow_up",
      "Follow-up / correction explanation",
      "فالو اپ / تصحیح کی وضاحت",
      1000,
      true,
    ],
  ];
  return (
    <section
      data-unsaved={dirty ? "true" : undefined}
      data-write-pending={write.blocked ? "true" : undefined}
    >
      {canRecord && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <h2>{t("Completed visit facts", "مکمل دورے کے حقائق")}</h2>
          <p>
            {t(
              "Record care that actually happened, not a planned visit. No times, consent or outcome are preselected.",
              "اصل ہو چکی نگہداشت درج کریں، طے شدہ دورہ نہیں۔ وقت، رضامندی یا نتیجہ پہلے منتخب نہیں۔",
            )}
          </p>
          {correction && (
            <p className="notice">
              {t(
                `New corrective entry for #${correction}; the original stays unchanged.`,
                `#${correction} کا نیا تصحیح اندراج؛ اصل برقرار ہے۔`,
              )}
            </p>
          )}
          <fieldset disabled={disabled}>
            <div className="form-grid">
              {controls.map(([key, en, ur, max, multiline]) => (
                <Field key={key} label={t(en, ur)}>
                  {multiline ? (
                    <textarea
                      data-help="home.facts"
                      value={draft[key] ?? ""}
                      maxLength={max}
                      required={!["accompanied_by", "follow_up"].includes(key)}
                      onChange={(e) => edit(key, e.target.value as any)}
                    />
                  ) : (
                    <input
                      data-help="home.facts"
                      value={draft[key] ?? ""}
                      maxLength={max}
                      required={key === "requested_by"}
                      onChange={(e) => edit(key, e.target.value as any)}
                    />
                  )}
                </Field>
              ))}
              <Field
                label={t(
                  "Request time (hospital time)",
                  "درخواست کا وقت (ہسپتال)",
                )}
              >
                <input
                  data-help="home.times"
                  type="datetime-local"
                  required
                  value={draft.requested_at}
                  onChange={(e) => edit("requested_at", e.target.value)}
                />
              </Field>
              <Field
                label={t("Visit time (hospital time)", "دورے کا وقت (ہسپتال)")}
              >
                <input
                  data-help="home.times"
                  type="datetime-local"
                  required
                  value={draft.visited_at}
                  onChange={(e) => edit("visited_at", e.target.value)}
                />
              </Field>
            </div>
            {ctx.patient.address && (
              <button
                data-help="home.address"
                type="button"
                onClick={() => {
                  if (
                    !draft.address ||
                    window.confirm(
                      t(
                        "Replace the unsaved visit address with the patient record address? Verify where the visit actually occurred.",
                        "مریض کے درج پتے سے غیر محفوظ پتہ بدلیں؟ اصل دورے کا پتہ چیک کریں۔",
                      ),
                    )
                  )
                    edit("address", ctx.patient.address || "");
                }}
              >
                {t(
                  "Copy recorded patient address for review",
                  "مریض کا درج پتہ چیک کے لیے نقل کریں",
                )}
              </button>
            )}
            <fieldset>
              <legend>
                {t(
                  "Examination consent — choose deliberately",
                  "معائنے کی رضامندی — خود چنیں",
                )}
              </legend>
              {(["VerbalObtained", "Declined", "NotExamined"] as const).map(
                (v) => (
                  <button
                    data-help="home.consent"
                    key={v}
                    type="button"
                    aria-pressed={draft.examination_consent === v}
                    onClick={() => consent(v)}
                  >
                    {v === "VerbalObtained"
                      ? t(
                          "Verbal consent obtained (VCO)",
                          "زبانی رضامندی حاصل (VCO)",
                        )
                      : v === "Declined"
                        ? t("Examination declined", "معائنہ مسترد")
                        : t("Not examined", "معائنہ نہیں کیا")}
                  </button>
                ),
              )}
            </fieldset>
            {draft.examination_consent === "VerbalObtained" && (
              <Field label={t("Examination findings", "معائنے کے نتائج")}>
                <textarea
                  data-help="home.consent"
                  maxLength={4000}
                  value={draft.examination || ""}
                  onChange={(e) => edit("examination", e.target.value)}
                />
              </Field>
            )}
            <Field label={t("Actual outcome", "اصل نتیجہ")}>
              <select
                data-help="home.outcome"
                required
                value={draft.outcome}
                onChange={(e) =>
                  edit("outcome", e.target.value as Draft["outcome"])
                }
              >
                <option value="">{t("Choose outcome", "نتیجہ چنیں")}</option>
                <option value="ManagedAtHome">
                  {t("Managed at home", "گھر پر نگہداشت")}
                </option>
                <option value="AskedToAttend">
                  {t("Asked to attend the facility", "ہسپتال آنے کو کہا")}
                </option>
                <option value="Referred">{t("Referred", "حوالہ دیا")}</option>
              </select>
            </Field>
            {draft.outcome === "Referred" && (
              <Field label={t("Referred to", "کہاں حوالہ دیا")}>
                <input
                  data-help="home.outcome"
                  required
                  maxLength={300}
                  value={draft.referred_to || ""}
                  onChange={(e) => edit("referred_to", e.target.value)}
                />
              </Field>
            )}
            <div className="toolbar">
              <button data-help="home.save" type="submit">
                {t("Record completed home visit", "مکمل دورہ درج کریں")}
              </button>
              <button data-help="home.new" type="button" onClick={newDraft}>
                {t("Clear / new home-visit draft", "صاف / نیا دورے کا مسودہ")}
              </button>
            </div>
          </fieldset>
        </form>
      )}
      <ErrorBox error={error} verbatim />
      <ClinicalWriteFeedback write={write} />
      {saved && (
        <section className="card">
          <h2>{t("Confirmed home-visit record", "تصدیق شدہ دورہ")}</h2>
          <VisitDetail record={saved} timeZone={timeZone} />
        </section>
      )}
      {canRead && (
        <VisitHistory
          patientId={ctx.patient.patient_id}
          revision={revision + local}
          user={user}
          timeZone={timeZone}
          canCorrect={!!canRecord && !disabled}
          correct={correct}
        />
      )}
    </section>
  );
}
function VisitDetail({
  record: r,
  timeZone,
}: {
  record: home.HomeVisitOut;
  timeZone?: string;
}) {
  const time = (s: string) => (timeZone ? formatHospitalTime(s, timeZone) : s);
  return (
    <article>
      <h3 dir="ltr">
        {r.visit_number} · #{r.home_visit_id}
      </h3>
      <p>
        {r.patient_name} · <bdi>{r.mrn}</bdi>
      </p>
      <dl>
        {[
          [t("Requested by", "درخواست کنندہ"), r.requested_by],
          [t("Request time", "درخواست کا وقت"), time(r.requested_at)],
          [t("Visit time", "دورے کا وقت"), time(r.visited_at)],
          [t("Reason", "وجہ"), r.reason],
          [t("Address", "پتہ"), r.address],
          [t("Accompanied by", "ساتھ جانے والا"), r.accompanied_by],
          [
            t("Examination consent", "معائنے کی رضامندی"),
            r.examination_consent === "VerbalObtained"
              ? "VCO · " + t("Verbal consent obtained", "زبانی رضامندی حاصل")
              : tr(r.examination_consent),
          ],
          [t("History", "تاریخ"), r.history],
          [t("Examination", "معائنہ"), r.examination],
          [t("Assessment", "رائے"), r.assessment],
          [t("Care given", "نگہداشت"), r.care_given],
          [t("Outcome", "نتیجہ"), tr(r.outcome)],
          [t("Referred to", "حوالے کی جگہ"), r.referred_to],
          [t("Follow-up", "فالو اپ"), r.follow_up],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd style={{ whiteSpace: "pre-wrap" }}>
              {value || t("Not recorded", "درج نہیں")}
            </dd>
          </div>
        ))}
      </dl>
      <p>{r.author_stamp.text}</p>
      <p>
        {t("Recorded", "درج ہوا")} {time(r.created_at)}
      </p>
    </article>
  );
}
function VisitHistory({
  patientId,
  revision,
  user,
  timeZone,
  canCorrect,
  correct,
}: {
  patientId: number;
  revision: number;
  user: ClinicalUser;
  timeZone?: string;
  canCorrect: boolean;
  correct: (r: home.HomeVisitOut) => void;
}) {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [query, setQuery] = useState<{
      date_from: string;
      date_to: string;
      patient_id: number;
      limit: number;
      before_id?: number;
    }>(),
    [back, setBack] = useState<(number | undefined)[]>([]),
    [selected, setSelected] = useState<home.HomeVisitOut>(),
    [error, setError] = useState<unknown>(),
    [detailBusy, setDetailBusy] = useState(false);
  const list = useLoad(
    () => (query ? registerHomeVisits(query) : Promise.resolve([])),
    [query, revision],
  );
  function search() {
    setError(undefined);
    if (!homeVisitDateRange(from, to)) {
      setError(
        new Error(
          t(
            "Enter a valid From/To range; From must not be after To.",
            "درست ابتدا و انتہا لکھیں؛ ابتدا بعد نہ ہو۔",
          ),
        ),
      );
      return;
    }
    setBack([]);
    setSelected(undefined);
    setQuery({
      date_from: from,
      date_to: to,
      patient_id: patientId,
      limit: 100,
    });
  }
  async function open(r: home.HomeVisitOut) {
    if (detailBusy) return;
    setError(undefined);
    setDetailBusy(true);
    try {
      const fresh = user.permissions.includes("homevisit.view")
        ? await api<home.HomeVisitOut>("GET", `/home-visits/${r.home_visit_id}`)
        : r;
      if (
        fresh.patient_id !== r.patient_id ||
        fresh.home_visit_id !== r.home_visit_id
      )
        throw new Error(
          t(
            "Returned record identity changed. Refresh the list.",
            "واپس شناخت بدل گئی۔ فہرست تازہ کریں۔",
          ),
        );
      setSelected(fresh);
    } catch (e) {
      setError(e);
    } finally {
      setDetailBusy(false);
    }
  }
  return (
    <section className="card">
      <h2>{t("Signed home-visit history", "دستخط شدہ دوروں کی تاریخ")}</h2>
      <p>
        {t(
          "Choose the dates to read this patient’s actual home visits. Access is logged; saved visits cannot be edited or deleted.",
          "اس مریض کے اصل دورے پڑھنے کی تاریخ چنیں۔ رسائی درج ہوتی ہے؛ محفوظ دورے تبدیل یا حذف نہیں۔",
        )}
      </p>
      <div className="toolbar">
        <Field label={t("Home visits from", "دورے ابتدا")}>
          <input
            data-help="home.history"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label={t("Home visits to", "دورے انتہا")}>
          <input
            data-help="home.history"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <button
          data-help="home.history"
          disabled={list.loading}
          onClick={search}
        >
          {t("Read home-visit history", "دوروں کی تاریخ پڑھیں")}
        </button>
      </div>
      <ErrorBox error={error} verbatim />
      <LoadState {...list} retry={list.reload} />
      {query && !list.loading && !list.error && list.data?.length === 0 && (
        <Empty>
          {t(
            "No home visits returned for this patient and period. Choose another period if appropriate.",
            "اس مریض اور مدت کا دورہ نہیں ملا۔ ضرورت ہو تو دوسری مدت چنیں۔",
          )}
        </Empty>
      )}
      {query &&
        !list.loading &&
        !list.error &&
        list.data?.map((r) => (
          <button
            key={r.home_visit_id}
            data-help="home.detail"
            disabled={detailBusy}
            onClick={() => void open(r)}
          >
            {r.visit_number} ·{" "}
            {timeZone
              ? formatHospitalTime(r.visited_at, timeZone)
              : r.visited_at}{" "}
            · {r.author_stamp.name}
          </button>
        ))}
      {query && (
        <div className="toolbar">
          <button
            data-help="home.history"
            disabled={list.loading || !back.length}
            onClick={() => {
              setSelected(undefined);
              setQuery({ ...query, before_id: back.at(-1) });
              setBack((b) => b.slice(0, -1));
            }}
          >
            {t("Newer home visits", "نئے دورے")}
          </button>
          <button
            data-help="home.history"
            disabled={list.loading || !!list.error || !list.data?.length}
            onClick={() => {
              setSelected(undefined);
              setBack((b) => [...b, query.before_id]);
              setQuery({
                ...query,
                before_id: list.data!.at(-1)!.home_visit_id,
              });
            }}
          >
            {t("Older home visits", "پرانے دورے")}
          </button>
        </div>
      )}
      {selected && (
        <>
          <VisitDetail record={selected} timeZone={timeZone} />
          {canCorrect && (
            <button data-help="home.correct" onClick={() => correct(selected)}>
              {t(
                `Record a corrective home visit for #${selected.home_visit_id}`,
                `دورے #${selected.home_visit_id} کی تصحیح درج کریں`,
              )}
            </button>
          )}
        </>
      )}
    </section>
  );
}
