import { useEffect, useState } from "react";
import { api, ApiError, getWithClock, call } from "../bridge";
import { bilingual as t, tr } from "../i18n";
import {
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { ClinicalPatient, type PatientContext } from "../clinical-patient";
import {
  mayChangeClinicalContext,
  type ClinicalUser,
} from "../clinical-context";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { hospitalTimeToUtc, formatHospitalTime } from "../hospital-time";
import { programmeEntryIssues, programmeWork } from "../programme-rules";
import type { EstablishmentOut } from "../generated/facility_profile";
import * as prog from "../generated/patient_programmes";
type Props = {
  user: ClinicalUser;
  revision: number;
  initialTicket?: number;
  readOnly: boolean;
  connected: boolean;
  timeZone?: string;
  establishment?: EstablishmentOut;
};
export function PatientProgrammes(props: Props) {
  const [patient, setPatient] = useState<number>();
  const [changes, setChanges] = useState(0);
  const capability = props.establishment?.capabilities.find(
    (c) => c.capability === "preventive_programmes",
  );
  return (
    <section>
      <h1>
        {t("Preventive programmes of a patient", "مریض کے حفاظتی پروگرام")}
      </h1>
      {capability?.state !== "Active" && (
        <p className="notice">
          {capability?.state === "Retiring"
            ? t(
                "No new enrolment from now on. Record service and Close remain for existing eligible enrolments.",
                "اب نیا اندراج نہیں۔ موجودہ موزوں اندراج کی خدمت و بند کرنا باقی ہے۔",
              )
            : t(
                "Preventive programmes are not active for new work. Existing history remains readable where the server permits it. Ask authorized facility staff before offering this service.",
                "حفاظتی پروگرام نئے کام کے لیے فعال نہیں۔ مجاز سابقہ تاریخ پڑھی جا سکتی ہے۔ خدمت دینے سے پہلے مجاز ہسپتال عملے سے چیک کریں۔",
              )}{" "}
          · {tr(capability?.state || "Unknown")}
        </p>
      )}
      <ClinicalPatient
        key={patient || "initial"}
        user={props.user}
        revision={props.revision}
        initialPatient={patient}
        initialTicket={patient ? undefined : props.initialTicket}
      >
        {(ctx) => <ProgrammePatient {...props} ctx={ctx} onChanged={() => setChanges(n => n + 1)} />}
      </ClinicalPatient>
      <DueList
        {...props}
        revision={props.revision + changes}
        onChoose={(id) => {
          if (mayChangeClinicalContext()) {
            setPatient(id);
            window.scrollTo(0, 0);
          }
        }}
      />
    </section>
  );
}
function ProgrammePatient({
  ctx,
  user,
  revision,
  readOnly,
  connected,
  timeZone,
  establishment,
  onChanged,
}: Props & { ctx: PatientContext; onChanged: () => void }) {
  const canGive = user.permissions.includes("programme.give"),
    canRead = user.permissions.some((p) =>
      ["programme.view", "programme.manage"].includes(p),
    );
  const [local, setLocal] = useState(0),
    [programme, setProgramme] = useState(""),
    [card, setCard] = useState(""),
    [selected, setSelected] = useState<number>(),
    [dirty, setDirty] = useState(false),
    [action, setAction] = useState<"entry" | "close">(),
    [actionDirty, setActionDirty] = useState(false),
    [service, setService] = useState(""),
    [given, setGiven] = useState(""),
    [batch, setBatch] = useState(""),
    [next, setNext] = useState(""),
    [note, setNote] = useState(""),
    [end, setEnd] = useState(""),
    [error, setError] = useState<unknown>(),
    [invalid, setInvalid] = useState<string[]>([]);
  const list = useLoad(
    () =>
      canRead
        ? prog.forPatientPatientsProgrammes(ctx.patient.patient_id)
        : Promise.resolve([]),
    [canRead, ctx.patient.patient_id, revision, local],
  );
  const catalogue = useLoad(
    () =>
      user.permissions.some((p) =>
        ["programme.view", "programme.manage", "msds.view"].includes(p),
      )
        ? prog.listProgrammes({ include_inactive: true })
        : Promise.resolve([]),
    [revision, local],
  );
  const current = list.data?.find(
      (e) =>
        e.enrolment_id === selected && e.patient_id === ctx.patient.patient_id,
    ),
    definition = catalogue.data?.find(
      (p) => p.programme_id === current?.programme_id,
    );
  const cap = establishment?.capabilities.find(
    (c) => c.capability === "preventive_programmes",
  );
  const work = programmeWork(
    cap?.state || "Unknown",
    canGive,
    readOnly,
    connected,
    current?.enrolled_at,
    cap?.state_since,
  );
  const write = useClinicalWrite(
    user,
    `programmes:${ctx.patient.patient_id}`,
    async (value, command) => {
      const saved = value as prog.EnrolmentOut;
      setSelected(saved.enrolment_id);
      if (command.path.startsWith("/patients/")) {
        setProgramme("");
        setCard("");
        setDirty(false);
      }
      setAction(undefined);
      setActionDirty(false);
      setInvalid([]);
      setLocal((n) => n + 1);
      onChanged();
      await ctx.reload();
    },
  );
  const blocked = write.blocked || !ctx.ready || !!ctx.patient.merged_into_id;
  const time = (s: string) => (timeZone ? formatHospitalTime(s, timeZone) : s);
  async function fresh() {
    const [patient, me, est, enrolments, programmes] = await Promise.all([
      api<any>("GET", `/patients/${ctx.patient.patient_id}`),
      getWithClock<ClinicalUser>("/auth/me"),
      api<EstablishmentOut>("GET", "/establishment"),
      prog.forPatientPatientsProgrammes(ctx.patient.patient_id),
      prog.listProgrammes({ include_inactive: true }),
    ]);
    if (
      readOnly ||
      !connected ||
      patient.patient_id !== ctx.patient.patient_id ||
      patient.merged_into_id ||
      me.data.user_id !== user.user_id ||
      !me.data.permissions.includes("programme.give")
    )
      throw new Error(
        t(
          "Patient identity or programme permission changed. Refresh and review.",
          "مریض کی شناخت یا پروگرام کی اجازت بدل گئی۔ تازہ کرکے چیک کریں۔",
        ),
      );
    const capability = est.capabilities.find(
      (c) => c.capability === "preventive_programmes",
    );
    return { patient, me, capability, enrolments, programmes };
  }
  function enrol() {
    setError(undefined);
    if (blocked || !work.enrol || ctx.patient.is_deceased) return;
    if (
      !programme ||
      !card.trim() ||
      !catalogue.data?.some(
        (p) => p.programme_id === Number(programme) && p.is_offered,
      )
    ) {
      setError(
        new Error(
          t(
            "Choose an offered programme and enter its actual card/register number.",
            "دیا جانے والا پروگرام اور اصل کارڈ/رجسٹر نمبر لکھیں۔",
          ),
        ),
      );
      return;
    }
    write.start(
      {
        method: "POST",
        path: `/patients/${ctx.patient.patient_id}/programmes`,
        body: {
          programme_id: Number(programme),
          card_number: card.trim(),
        } satisfies prog.EnrolIn,
        permission: "programme.give",
        protection: "idempotent",
        label: t("Enrol in programme", "پروگرام میں اندراج"),
        reconcilePath: `/patients/${ctx.patient.patient_id}/programmes`,
      },
      async () => {
        const now = await fresh();
        if (
          now.patient.is_deceased ||
          now.capability?.state !== "Active" ||
          !now.programmes.some(
            (p) => p.programme_id === Number(programme) && p.is_offered,
          )
        )
          throw new Error(
            t(
              "New enrolment is unavailable for this patient/programme/service.",
              "اس مریض، پروگرام یا خدمت میں نیا اندراج دستیاب نہیں۔",
            ),
          );
        const existing = now.enrolments.find(
          (e) => e.programme_id === Number(programme) && e.status === "Active",
        );
        if (existing) {
          setSelected(existing.enrolment_id);
          throw new Error(
            t(
              "This patient is already enrolled. Open the selected existing enrolment; do not create another.",
              "مریض پہلے درج ہے۔ منتخب اصل اندراج کھولیں؛ دوسرا نہ بنائیں۔",
            ),
          );
        }
      },
    );
  }
  async function findExisting() {
    setError(undefined);
    try {
      const real = await prog.forPatientPatientsProgrammes(
        ctx.patient.patient_id,
      );
      const existing = real.find(
        (e) => e.programme_id === Number(programme) && e.status === "Active",
      );
      if (!existing)
        throw new Error(
          t(
            "No current open enrolment was returned. Reconcile with the programme team.",
            "موجودہ کھلا اندراج نہیں آیا۔ پروگرام عملے سے چیک کریں۔",
          ),
        );
      if (mayChangeClinicalContext()) {
        setSelected(existing.enrolment_id);
        setLocal((n) => n + 1);
        setDirty(false);
      }
    } catch (e) {
      setError(e);
    }
  }
  function closeDialog() {
    if (write.blocked) return;
    if (
      actionDirty &&
      !window.confirm(
        t(
          "Discard unsent programme service/closure details?",
          "پروگرام کی غیر ارسال خدمت یا بندش چھوڑ دیں؟",
        ),
      )
    )
      return;
    setAction(undefined);
    setActionDirty(false);
  }
  function submitAction() {
    setError(undefined);
    setInvalid([]);
    if (!current || current.status !== "Active" || blocked || !action) return;
    try {
      if (action === "entry") {
        if (!work.entry || !definition || !service || !given)
          throw new Error(
            t(
              "Choose the programme’s actual service and when it was given.",
              "پروگرام کی اصل خدمت اور دینے کا وقت چنیں۔",
            ),
          );
        const body: prog.ProgrammeEntryIn = {
          service,
          given_at: hospitalTimeToUtc(given, timeZone || ""),
          batch_number: batch || null,
          next_due_on: next || null,
          note: note || null,
        };
        write.start(
          {
            method: "POST",
            path: `/programme-enrolments/${current.enrolment_id}/entries`,
            body,
            permission: "programme.give",
            protection: "idempotent",
            label: t("Record programme service", "پروگرام کی خدمت درج کریں"),
            reconcilePath: `/patients/${ctx.patient.patient_id}/programmes`,
          },
          async () => {
            const now = await fresh(),
              actual = now.enrolments.find(
                (e) =>
                  e.enrolment_id === current.enrolment_id &&
                  e.patient_id === ctx.patient.patient_id,
              ),
              programme = now.programmes.find(
                (p) => p.programme_id === actual?.programme_id,
              );
            if (
              !actual ||
              actual.status !== "Active" ||
              !programme ||
              !programmeWork(
                now.capability?.state || "",
                true,
                false,
                true,
                actual.enrolled_at,
                now.capability?.state_since,
              ).entry
            )
              throw new Error(
                t(
                  "The enrolment or service state changed; refresh before recording.",
                  "اندراج یا خدمت کی حالت بدل گئی؛ درج کرنے سے پہلے تازہ کریں۔",
                ),
              );
            const issues = programmeEntryIssues(
              body,
              programme.services,
              now.me.now,
              given.slice(0, 10),
            );
            if (issues.length) {
              setInvalid(issues);
              throw new Error(
                t(
                  "Check the service, actual past time and card-written next date; no schedule is computed.",
                  "خدمت، اصل گزشتہ وقت اور کارڈ کی اگلی تاریخ چیک کریں؛ کوئی شیڈول حساب نہیں ہوتا۔",
                ),
              );
            }
          },
        );
      } else {
        if (
          !work.close ||
          !["Completed", "TransferredOut", "Discontinued"].includes(end) ||
          ((end === "TransferredOut" || end === "Discontinued") && !note.trim())
        )
          throw new Error(
            t(
              "Choose closure status; transfer needs the destination and discontinuation needs the reason.",
              "بندش کی حالت؛ منتقلی کو منزل اور بند کرنے کو وجہ لازم۔",
            ),
          );
        write.start(
          {
            method: "POST",
            path: `/programme-enrolments/${current.enrolment_id}/close`,
            body: {
              status: end as prog.EnrolmentCloseIn["status"],
              note: note || null,
            },
            permission: "programme.give",
            protection: "reconcile",
            label: t("Close programme enrolment", "پروگرام کا اندراج بند کریں"),
            reconcilePath: `/patients/${ctx.patient.patient_id}/programmes`,
          },
          async () => {
            const now = await fresh();
            if (
              !now.enrolments.some(
                (e) =>
                  e.enrolment_id === current.enrolment_id &&
                  e.patient_id === ctx.patient.patient_id &&
                  e.status === "Active",
              )
            )
              throw new Error(
                t(
                  "The enrolment is already closed. Read its current outcome; do not replay closure.",
                  "اندراج پہلے بند ہے۔ موجودہ نتیجہ پڑھیں؛ بندش نہ دہرائیں۔",
                ),
              );
          },
        );
      }
    } catch (e) {
      setError(e);
    }
  }
  return (
    <section data-write-pending={write.blocked ? "true" : "false"}>
      <ErrorBox error={error} verbatim />
      {!action && <ClinicalWriteFeedback write={write} />}
      {write.error instanceof ApiError &&
        write.error.response.error?.code === "PROGRAMME_ENROLLED" && (
          <button
            data-help="programme.enrol"
            onClick={() => void findExisting()}
          >
            {t("Read and open existing enrolment", "اصل اندراج پڑھ کر کھولیں")}
          </button>
        )}
      <LoadState {...catalogue} retry={catalogue.reload} />
      {work.enrol && (
        <section className="card" data-unsaved={dirty ? "true" : "false"}>
          <h2>{t("New programme enrolment", "پروگرام کا نیا اندراج")}</h2>
          <fieldset
            disabled={blocked || ctx.patient.is_deceased}
            onChange={() => setDirty(true)}
          >
            <Field label={t("Offered programme", "دیا جانے والا پروگرام")}>
              <select
                data-help="programme.enrol"
                value={programme}
                onChange={(e) => setProgramme(e.target.value)}
              >
                <option value="">
                  {t("Choose actual programme", "اصل پروگرام چنیں")}
                </option>
                {catalogue.data
                  ?.filter((p) => p.is_offered)
                  .map((p) => (
                    <option key={p.programme_id} value={p.programme_id}>
                      {p.name} · {tr(p.kind)} · {p.national_programme}
                    </option>
                  ))}
              </select>
            </Field>
            <Field
              label={t(
                "Programme card / register number",
                "پروگرام کا کارڈ / رجسٹر نمبر",
              )}
            >
              <input
                data-help="programme.enrol"
                value={card}
                maxLength={100}
                onChange={(e) => setCard(e.target.value)}
              />
            </Field>
            <button data-help="programme.enrol" onClick={enrol}>
              {t("Enrol patient", "مریض کا اندراج کریں")}
            </button>
            <button
              data-help="programme.enrol"
              onClick={() => {
                if (mayChangeClinicalContext()) {
                  setProgramme("");
                  setCard("");
                  setDirty(false);
                }
              }}
            >
              {t("Clear enrolment draft", "اندراج کا مسودہ صاف کریں")}
            </button>
          </fieldset>
          {!catalogue.loading &&
            !catalogue.error &&
            !catalogue.data?.some((p) => p.is_offered) && (
              <Empty>
                {t(
                  "No offered programme. Ask the authorized programme/quality team; do not invent a programme.",
                  "دیا جانے والا پروگرام نہیں۔ مجاز پروگرام/کوالٹی عملے سے کہیں؛ فرضی پروگرام نہیں۔",
                )}
              </Empty>
            )}
        </section>
      )}
      <section className="card">
        <h2>{t("Patient programme history", "مریض کے پروگرام کی تاریخ")}</h2>
        <button data-help="programme.history" disabled={write.blocked || !canRead || !connected} onClick={() => { setLocal(n => n + 1); onChanged(); }}>{t("Refresh programme history and due list", "پروگرام کی تاریخ اور اگلی خدمت تازہ کریں")}</button>
        <LoadState {...list} retry={list.reload} />
        {!canRead && (
          <p>
            {t(
              "Your account cannot read programme history. Ask authorized staff.",
              "آپ کو پروگرام کی تاریخ پڑھنے کی اجازت نہیں۔ مجاز عملے سے کہیں۔",
            )}
          </p>
        )}
        {!list.loading &&
          !list.error &&
          list.data?.map((e) => (
            <article key={e.enrolment_id}>
              <h3>
                {e.programme_name} · <bdi>{e.enrolment_number}</bdi> ·{" "}
                {tr(e.status)}
              </h3>
              <p>
                {e.patient_name} · <bdi>{e.mrn}</bdi> · {t("Card", "کارڈ")}:{" "}
                {e.card_number || t("Not recorded", "درج نہیں")} ·{" "}
                {time(e.enrolled_at)}
              </p>
              <button
                data-help="programme.history"
                disabled={write.blocked}
                onClick={() => {
                  if (mayChangeClinicalContext()) setSelected(e.enrolment_id);
                }}
              >
                {t("Open enrolment", "اندراج کھولیں")}{" "}
                <bdi>{e.enrolment_number}</bdi>
              </button>
            </article>
          ))}
        {!list.loading && !list.error && !list.data?.length && (
          <Empty>
            {t(
              "No programme enrolments returned for this patient.",
              "اس مریض کا پروگرام اندراج نہیں آیا۔",
            )}
          </Empty>
        )}
        {current && (
          <article>
            <h3>
              {current.programme_name} · {tr(current.status)}
            </h3>
            <p>
              {definition?.national_programme} · {definition?.guideline}
            </p>
            <p>
              {current.close_note} ·{" "}
              {current.closed_at && time(current.closed_at)}
            </p>
            {current.entries.map((e) => (
              <article className="card" key={e.entry_id}>
                <strong>{e.service}</strong>
                <p>
                  {time(e.given_at)} · {t("Batch", "بیچ")}:{" "}
                  <bdi>{e.batch_number || t("Not recorded", "درج نہیں")}</bdi>
                </p>
                <p>
                  {t("Next date as on card", "کارڈ پر لکھی اگلی تاریخ")}:{" "}
                  <bdi>{e.next_due_on || t("Not recorded", "درج نہیں")}</bdi>
                </p>
                <p>{e.note}</p>
                <p className="notice">{e.given_by_stamp.text}</p>
              </article>
            ))}
            {!current.entries.length && (
              <p>
                {t(
                  "No services recorded in this enrolment.",
                  "اس اندراج میں خدمت درج نہیں۔",
                )}
              </p>
            )}
            {current.status === "Active" && (
              <>
                {work.entry && (
                  <button
                    data-help="programme.entry"
                    disabled={blocked}
                    onClick={() => {
                      setAction("entry");
                      setService("");
                      setGiven("");
                      setBatch("");
                      setNext("");
                      setNote("");
                      setInvalid([]);
                      setActionDirty(false);
                    }}
                  >
                    {t("Record programme service", "پروگرام کی خدمت درج کریں")}
                  </button>
                )}
                {work.close && (
                  <button
                    data-help="programme.close"
                    disabled={blocked}
                    onClick={() => {
                      setAction("close");
                      setEnd("");
                      setNote("");
                      setActionDirty(false);
                    }}
                  >
                    {t("Close enrolment", "اندراج بند کریں")}
                  </button>
                )}
              </>
            )}
            {current.status !== "Active" && (
              <p>
                {t(
                  "Closed enrolment: no further services. A new deliberate enrolment is needed to continue, only while the service is Active.",
                  "بند اندراج میں نئی خدمت نہیں۔ جاری کرنے کو فعال خدمت میں سوچا ہوا نیا اندراج لازم ہے۔",
                )}
              </p>
            )}
          </article>
        )}
      </section>
      <details>
        <summary data-help="programme.catalogue">
          {t(
            "Programme catalogue and national guidance",
            "پروگرام کی فہرست اور قومی رہنما",
          )}
        </summary>
        {catalogue.data?.map((p) => (
          <article key={p.programme_id}>
            <h3>
              {p.name} · {tr(p.kind)} ·{" "}
              {p.is_offered
                ? t("Offered", "دیا جاتا ہے")
                : t("Not offered", "نہیں دیا جاتا")}
            </h3>
            <p>{p.national_programme}</p>
            <p>{p.guideline}</p>
            <p>{p.services.join(" · ")}</p>
          </article>
        ))}
        <p>
          {t(
            "No vaccination schedule, due date, dose or patient card is computed or invented here. The programme card and national guidance are authoritative.",
            "یہاں ویکسین کا شیڈول، اگلی تاریخ، خوراک یا کارڈ حساب/فرض نہیں ہوتا۔ پروگرام کا اصل کارڈ و قومی رہنما اصل ہیں۔",
          )}
        </p>
      </details>
      {action && current && (
        <Modal
          title={
            action === "entry"
              ? t("Record programme service", "پروگرام کی خدمت درج کریں")
              : t("Close programme enrolment", "پروگرام کا اندراج بند کریں")
          }
          onClose={closeDialog}
          closable={!write.blocked}
        >
          <p>
            {ctx.patient.full_name} ·{" "}
            <bdi>
              {ctx.patient.mrn} · {current.enrolment_number}
            </bdi>{" "}
            · {current.programme_name}
          </p>
          <section data-unsaved={actionDirty ? "true" : "false"}>
            <fieldset disabled={blocked} onChange={() => setActionDirty(true)}>
              {action === "entry" ? (
                <>
                  <Field
                    label={t(
                      "Service from programme card",
                      "پروگرام کارڈ کی خدمت",
                    )}
                  >
                    <select
                      data-help="programme.entry"
                      value={service}
                      aria-invalid={invalid.includes("service")}
                      onChange={(e) => setService(e.target.value)}
                    >
                      <option value="">
                        {t("Choose actual listed service", "اصل درج خدمت چنیں")}
                      </option>
                      {definition?.services.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label={t(
                      "Service given at (hospital time)",
                      "خدمت دینے کا وقت (ہسپتال)",
                    )}
                  >
                    <input
                      data-help="programme.entry"
                      type="datetime-local"
                      value={given}
                      aria-invalid={invalid.includes("given_at")}
                      onChange={(e) => setGiven(e.target.value)}
                    />
                  </Field>
                  <Field
                    label={t(
                      "Batch (vaccines / medicines, if applicable)",
                      "بیچ (ویکسین / دوائی، جہاں لازم)",
                    )}
                  >
                    <input
                      data-help="programme.entry"
                      value={batch}
                      maxLength={100}
                      onChange={(e) => setBatch(e.target.value)}
                    />
                  </Field>
                  <Field
                    label={t(
                      "Next date exactly as card says (optional)",
                      "کارڈ کے عین مطابق اگلی تاریخ (اختیاری)",
                    )}
                  >
                    <input
                      data-help="programme.entry"
                      type="date"
                      value={next}
                      aria-invalid={invalid.includes("next_due_on")}
                      onChange={(e) => setNext(e.target.value)}
                    />
                  </Field>
                  <p>
                    {t(
                      "Never pre-fill or calculate the next service date. Copy the actual card; record a vaccine/medicine batch when given.",
                      "اگلی تاریخ پہلے نہ بھریں یا حساب نہ کریں۔ اصل کارڈ اور دی ویکسین/دوائی کا بیچ نقل کریں۔",
                    )}
                  </p>
                </>
              ) : (
                <Field
                  label={t("Close with outcome", "نتیجے کے ساتھ بند کریں")}
                >
                  <select
                    data-help="programme.close"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  >
                    <option value="">
                      {t("Choose actual outcome", "اصل نتیجہ چنیں")}
                    </option>
                    {["Completed", "TransferredOut", "Discontinued"].map(
                      (v) => (
                        <option key={v} value={v}>
                          {tr(v)}
                        </option>
                      ),
                    )}
                  </select>
                </Field>
              )}
              <Field
                label={
                  action === "close"
                    ? end === "TransferredOut"
                      ? t("Where transferred", "منتقلی کی منزل")
                      : end === "Discontinued"
                        ? t("Why discontinued", "بند کرنے کی وجہ")
                        : t("Closure note (optional)", "بندش کا نوٹ (اختیاری)")
                    : t(
                        "Programme service note (optional)",
                        "پروگرام خدمت کا نوٹ (اختیاری)",
                      )
                }
              >
                <textarea
                  data-help="programme.action"
                  value={note}
                  maxLength={1000}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
              <button data-help="programme.action" onClick={submitAction}>
                {t("Confirm programme action", "پروگرام عمل کی تصدیق")}
              </button>
              <button data-help="programme.action" onClick={closeDialog}>
                {t("Cancel", "منسوخ")}
              </button>
            </fieldset>
            <ErrorBox error={error} verbatim />
            <ClinicalWriteFeedback write={write} />
          </section>
        </Modal>
      )}
    </section>
  );
}
function DueList({
  user,
  revision,
  timeZone,
  onChoose,
}: Props & { onChoose: (id: number) => void }) {
  const can = user.permissions.includes("programme.view"),
    [on, setOn] = useState(""),
    [programme, setProgramme] = useState(""),
    [before, setBefore] = useState<number>(),
    [back, setBack] = useState<(number | undefined)[]>([]),
    [error, setError] = useState<unknown>();
  const clock = useLoad(() => getWithClock<ClinicalUser>("/auth/me"), []);
  useEffect(() => {
    if (on || !clock.data || !timeZone) return;
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(clock.data.now));
    const get = (key: string) => p.find((p) => p.type === key)?.value;
    setOn(`${get("year")}-${get("month")}-${get("day")}`);
  }, [clock.data, timeZone]);
  const catalogue = useLoad(
    () =>
      can
        ? prog.listProgrammes({ include_inactive: true })
        : Promise.resolve([]),
    [can, revision],
  );
  const due = useLoad(
    () =>
      can && on
        ? prog.due({
            on,
            programme_id: programme ? Number(programme) : undefined,
            limit: 100,
            before_id: before,
          })
        : Promise.resolve([]),
    [can, on, programme, before, revision],
  );
  async function printList() {
    setError(undefined);
    try {
      await call("clinical-pdf", {
        path: "/preventive-programmes/list/pdf",
        preview: true,
      });
    } catch (e) {
      setError(e);
    }
  }
  return (
    <section className="card">
      <h2>
        {t(
          "Patients due by their programme cards",
          "کارڈ کے مطابق اگلی خدمت والے مریض",
        )}
      </h2>
      <p>
        {t(
          "Patient-record reads are logged. Use only authorized follow-up. Numbers are for staff contact; nothing here sends a message or computes a medical schedule.",
          "مریض ریکارڈ کی پڑھائی درج ہے۔ صرف مجاز رابطہ؛ نمبر عملے کے لیے، یہاں کوئی پیغام یا طبی شیڈول حساب نہیں ہوتا۔",
        )}
      </p>
      <LoadState {...clock} retry={clock.reload} />
      <ErrorBox error={error} />
      {can ? (
        <>
          <Field label={t("Due on or before", "اس تاریخ تک اگلی خدمت")}>
            <input
              data-help="programme.due"
              type="date"
              value={on}
              onChange={(e) => {
                setOn(e.target.value);
                setBefore(undefined);
                setBack([]);
              }}
            />
          </Field>
          <Field label={t("Due programme filter", "اگلی خدمت کا پروگرام فلٹر")}>
            <select
              data-help="programme.due"
              value={programme}
              onChange={(e) => {
                setProgramme(e.target.value);
                setBefore(undefined);
                setBack([]);
              }}
            >
              <option value="">{t("All programmes", "تمام پروگرام")}</option>
              {catalogue.data?.map((p) => (
                <option key={p.programme_id} value={p.programme_id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <LoadState {...due} retry={due.reload} />
          {on &&
            !due.loading &&
            !due.error &&
            due.data?.map((r) => (
              <article key={r.enrolment_id}>
                <strong>{r.patient_name}</strong> ·{" "}
                <bdi>
                  {r.mrn} ·{" "}
                  {r.mobile || t("Phone not recorded", "فون درج نہیں")}
                </bdi>
                <p>
                  {r.programme_name} · {r.card_number} · {r.last_service} ·{" "}
                  <bdi>{r.next_due_on}</bdi>
                </p>
                <button
                  data-help="programme.due"
                  onClick={() => onChoose(r.patient_id)}
                >
                  {t(
                    "Open this programme patient",
                    "پروگرام کا یہ مریض کھولیں",
                  )}
                </button>
              </article>
            ))}
          {on && !due.loading && !due.error && !due.data?.length && (
            <Empty>
              {t(
                "No open enrolments are due in this returned page.",
                "اس واپس آئے صفحے میں کوئی کھلا واجب خدمت اندراج نہیں۔",
              )}
            </Empty>
          )}
          <button
            data-help="programme.due"
            disabled={due.loading || !!due.error || !due.data?.length}
            onClick={() => {
              setBack((prev) => [...prev, before]);
              setBefore(due.data!.at(-1)!.enrolment_id);
            }}
          >
            {t("Older due enrolments", "پرانے واجب خدمت اندراج")}
          </button>
          <button
            data-help="programme.due"
            disabled={due.loading || !back.length}
            onClick={() => {
              setBefore(back.at(-1));
              setBack((prev) => prev.slice(0, -1));
            }}
          >
            {t("Newer due enrolments", "نئے واجب خدمت اندراج")}
          </button>
        </>
      ) : (
        <p>
          {t(
            "Your account is not permitted to read the due list.",
            "آپ کو واجب خدمت کی فہرست پڑھنے کی اجازت نہیں۔",
          )}
        </p>
      )}
      {user.permissions.some(p=>['programme.manage','msds.view'].includes(p))&&<button data-help="programme.catalogue" onClick={()=>void printList()}>{t('Open offered-programme list PDF / print','دستیاب پروگرام کی پی ڈی ایف / پرنٹ کھولیں')}</button>}
    </section>
  );
}
