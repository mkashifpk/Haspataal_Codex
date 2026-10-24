import { useEffect, useState } from "react";
import { api } from "../bridge";
import { bilingual as t, tr } from "../i18n";
import { Empty, ErrorBox, Field, LoadState, useLoad } from "../components";
import { ClinicalPatient, type PatientContext } from "../clinical-patient";
import {
  mayChangeClinicalContext,
  type ClinicalUser,
} from "../clinical-context";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { formatHospitalTime } from "../hospital-time";
import * as edu from "../generated/patient_education";
import * as emr from "../generated/consultation";
type Props = {
  user: ClinicalUser;
  revision: number;
  initialTicket?: number;
  readOnly: boolean;
  connected: boolean;
  timeZone?: string;
};
export function PatientEducation(props: Props) {
  return (
    <section>
      <h1>{t("Health education given", "دی گئی صحت کی رہنمائی")}</h1>
      <ClinicalPatient
        user={props.user}
        revision={props.revision}
        initialTicket={props.initialTicket}
      >
        {(ctx) => <EducationForm {...props} ctx={ctx} />}
      </ClinicalPatient>
    </section>
  );
}
function EducationForm({
  ctx,
  user,
  revision,
  readOnly,
  connected,
  timeZone,
}: Props & { ctx: PatientContext }) {
  const canGive = user.permissions.includes("education.give"),
    canRead = canGive || user.permissions.includes("education.manage");
  const [local, setLocal] = useState(0),
    [before, setBefore] = useState<number>(),
    [back, setBack] = useState<(number | undefined)[]>([]),
    [topic, setTopic] = useState(""),
    [method, setMethod] = useState(""),
    [givenTo, setGivenTo] = useState(""),
    [material, setMaterial] = useState(""),
    [encounter, setEncounter] = useState(""),
    [note, setNote] = useState(""),
    [dirty, setDirty] = useState(false),
    [correction, setCorrection] = useState<number>(),
    [error, setError] = useState<unknown>(),
    [materialFilter, setMaterialFilter] = useState("");
  const records = useLoad(
    () =>
      canRead
        ? edu.forPatientPatientsEducation(ctx.patient.patient_id, {
            limit: 100,
            before_id: before,
          })
        : Promise.resolve([]),
    [canRead, ctx.patient.patient_id, revision, local, before],
  );
  const materials = useLoad(
    () =>
      canRead || user.permissions.includes("msds.view")
        ? edu.listMaterials({ include_inactive: false })
        : Promise.resolve([]),
    [canRead, revision, local],
  );
  const notes = useLoad(
    () =>
      user.permissions.includes("clinical.encounter.view")
        ? emr.forPatientPatientsClinicalEncounters(ctx.patient.patient_id)
        : Promise.resolve([]),
    [ctx.patient.patient_id, revision, local],
  );
  useEffect(() => {
    if (encounter || dirty || !ctx.ticket) return;
    const current = notes.data?.filter(
      (n) =>
        n.patient_id === ctx.patient.patient_id &&
        n.ticket_id === ctx.ticket!.ticket_id &&
        n.status === "Final",
    );
    if (current?.length === 1) setEncounter(String(current[0].encounter_id));
  }, [notes.data, ctx.ticket?.ticket_id]);
  const write = useClinicalWrite(
    user,
    `education:${ctx.patient.patient_id}`,
    async () => {
      clear();
      setBefore(undefined);
      setBack([]);
      setLocal((n) => n + 1);
      await ctx.reload();
    },
  );
  const disabled =
    readOnly ||
    !connected ||
    !ctx.ready ||
    !!ctx.patient.merged_into_id ||
    write.blocked ||
    !canGive;
  const time = (s: string) => (timeZone ? formatHospitalTime(s, timeZone) : s);
  function clear() {
    setTopic("");
    setMethod("");
    setGivenTo("");
    setMaterial("");
    setNote("");
    setCorrection(undefined);
    setDirty(false);
  }
  function newRecord() {
    if (mayChangeClinicalContext()) {
      clear();
      setError(undefined);
    }
  }
  function correct(r: edu.EducationOut) {
    if (!mayChangeClinicalContext()) return;
    setTopic(r.topic);
    setMethod(r.method);
    setGivenTo(r.given_to);
    setMaterial(
      r.material_id &&
        materials.data?.some(
          (m) => m.material_id === r.material_id && m.is_active,
        )
        ? String(r.material_id)
        : "",
    );
    setEncounter(r.encounter_id ? String(r.encounter_id) : "");
    setNote("");
    setCorrection(r.education_id);
    setDirty(true);
    setError(undefined);
  }
  function save() {
    setError(undefined);
    if (disabled) return;
    try {
      if (topic.trim().length < 3 || !method || !givenTo)
        throw new Error(
          t(
            "Enter a topic of at least 3 characters and choose the actual method and recipient.",
            "کم از کم3حروف کا موضوع اور اصل طریقہ و وصول کنندہ چنیں۔",
          ),
        );
      if ((method === "Leaflet" || method === "Video") && !material)
        throw new Error(
          t(
            "A leaflet or video requires the actual active material used.",
            "پرچے یا ویڈیو کے لیے استعمال شدہ اصل فعال مواد لازم ہے۔",
          ),
        );
      if (
        material &&
        !materials.data?.some(
          (m) => m.material_id === Number(material) && m.is_active,
        )
      )
        throw new Error(
          t(
            "Select a current active education material.",
            "موجودہ فعال رہنمائی مواد چنیں۔",
          ),
        );
      if (
        encounter &&
        !notes.data?.some(
          (n) =>
            n.encounter_id === Number(encounter) &&
            n.patient_id === ctx.patient.patient_id &&
            n.status !== "Cancelled",
        )
      )
        throw new Error(
          t(
            "Select the actual encounter of this patient.",
            "اسی مریض کی اصل ملاقات چنیں۔",
          ),
        );
      if (correction && note.trim().length < 3)
        throw new Error(
          t(
            "Explain what this new corrective entry clarifies. The original is never changed.",
            "اس نئے اصلاحی اندراج کی وضاحت دیں۔ اصل نہیں بدلتا۔",
          ),
        );
      const body: edu.EducationIn = {
        topic: topic.trim(),
        method: method as edu.EducationIn["method"],
        given_to: givenTo as edu.EducationIn["given_to"],
        material_id: material ? Number(material) : null,
        encounter_id: encounter ? Number(encounter) : null,
        note: correction
          ? `${t("Correction of education record", "رہنمائی ریکارڈ کی تصحیح")} #${correction}: ${note.trim()}`
          : note || null,
      };
      write.start(
        {
          method: "POST",
          path: `/patients/${ctx.patient.patient_id}/education`,
          body,
          permission: "education.give",
          protection: "idempotent",
          label: t("Record health education", "صحت کی رہنمائی درج کریں"),
          reconcilePath: `/patients/${ctx.patient.patient_id}/education?limit=100`,
        },
        async () => {
          const [patient, me] = await Promise.all([
            api<any>("GET", `/patients/${ctx.patient.patient_id}`),
            api<any>("GET", "/auth/me"),
          ]);
          if (
            patient.patient_id !== ctx.patient.patient_id ||
            patient.merged_into_id ||
            me.user_id !== user.user_id ||
            !me.permissions.includes("education.give")
          )
            throw new Error(
              t(
                "Patient identity or education permission changed. Refresh and review.",
                "مریض کی شناخت یا رہنمائی کی اجازت بدل گئی۔ تازہ کرکے چیک کریں۔",
              ),
            );
          if (
            material &&
            !(await edu.listMaterials({ include_inactive: false })).some(
              (m) => m.material_id === Number(material) && m.is_active,
            )
          )
            throw new Error(
              t(
                "The selected material was retired. Choose an active material actually used.",
                "منتخب مواد بند ہوگیا۔ اصل استعمال شدہ فعال مواد چنیں۔",
              ),
            );
          if (encounter) {
            const n = await emr.getClinicalEncounters(Number(encounter));
            if (
              n.patient_id !== ctx.patient.patient_id ||
              n.status === "Cancelled"
            )
              throw new Error(
                t(
                  "The linked encounter changed. Re-select it.",
                  "منسلک ملاقات بدل گئی۔ دوبارہ چنیں۔",
                ),
              );
          }
        },
      );
    } catch (e) {
      setError(e);
    }
  }
  return (
    <section data-write-pending={write.blocked ? "true" : "false"}>
      <ErrorBox error={error} verbatim />
      <ClinicalWriteFeedback write={write} />
      <p>
        {t(
          "Record what was actually explained, to whom and using which material. Saving a record does not give guidance, play a video or print a leaflet.",
          "جو واقعی سمجھایا، کس کو اور کس مواد سے، وہ درج کریں۔ محفوظ کرنا رہنمائی دینا، ویڈیو چلانا یا پرچہ پرنٹ کرنا نہیں۔",
        )}
      </p>
      {canGive && (
        <section className="card" data-unsaved={dirty ? "true" : "false"}>
          <h2>
            {correction
              ? t("New corrective education entry", "نیا اصلاحی رہنمائی اندراج")
              : t("Record health education", "صحت کی رہنمائی درج کریں")}
          </h2>
          {correction && (
            <p className="notice">
              {t(
                "The original education record stays unchanged. This creates a separate signed entry referencing",
                "اصل رہنمائی برقرار ہے۔ یہ الگ دستخط شدہ اندراج اسی اصل نمبر کا حوالہ ہے",
              )}
              : <bdi>#{correction}</bdi>
            </p>
          )}
          <fieldset disabled={disabled} onChange={() => setDirty(true)}>
            <Field label={t("Education topic", "رہنمائی کا موضوع")}>
              <input
                data-help="education.record"
                value={topic}
                minLength={3}
                maxLength={300}
                onChange={(e) => setTopic(e.target.value)}
              />
            </Field>
            <Field label={t("Education method", "رہنمائی کا طریقہ")}>
              <select
                data-help="education.record"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="">
                  {t("Choose actual method", "اصل طریقہ چنیں")}
                </option>
                {[
                  "Verbal",
                  "Leaflet",
                  "WrittenInstructions",
                  "Demonstration",
                  "Video",
                ].map((v) => (
                  <option key={v} value={v}>
                    {tr(v)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Education given to", "رہنمائی لینے والا")}>
              <select
                data-help="education.record"
                value={givenTo}
                onChange={(e) => setGivenTo(e.target.value)}
              >
                <option value="">
                  {t("Choose recipient", "وصول کنندہ چنیں")}
                </option>
                {["Patient", "Attendant", "Both"].map((v) => (
                  <option key={v} value={v}>
                    {tr(v)}
                  </option>
                ))}
              </select>
            </Field>
            <LoadState {...materials} retry={materials.reload} />
            <Field label={t("Material actually used", "اصل استعمال شدہ مواد")}>
              <select
                data-help="education.material"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
              >
                <option value="">
                  {t("No material selected", "مواد منتخب نہیں")}
                </option>
                {materials.data
                  ?.filter((m) => m.is_active)
                  .map((m) => (
                    <option key={m.material_id} value={m.material_id}>
                      {m.title} · {tr(m.kind)} · {tr(m.language)} · {m.topic}
                    </option>
                  ))}
              </select>
            </Field>
            <p>
              {t(
                "Material is required for Leaflet and Video. The catalogue describes the hospital’s actual resources; it is not a video player or a downloadable file.",
                "پرچے و ویڈیو کے لیے مواد لازم۔ فہرست ہسپتال کے اصل وسائل بتاتی ہے؛ ویڈیو چلانے یا فائل لینے کا ذریعہ نہیں۔",
              )}
            </p>
            <LoadState {...notes} retry={notes.reload} />
            <Field label={t("Education consultation", "رہنمائی کی طبی ملاقات")}>
              <select
                data-help="education.encounter"
                value={encounter}
                onChange={(e) => setEncounter(e.target.value)}
              >
                <option value="">
                  {t("No linked encounter", "ملاقات منسلک نہیں")}
                </option>
                {notes.data
                  ?.filter(
                    (n) =>
                      n.patient_id === ctx.patient.patient_id &&
                      n.status !== "Cancelled",
                  )
                  .map((n) => (
                    <option key={n.encounter_id} value={n.encounter_id}>
                      {n.encounter_id} · {tr(n.encounter_type)} · {tr(n.status)}{" "}
                      · {n.chief_complaint}
                    </option>
                  ))}
              </select>
            </Field>
            <Field
              label={
                correction
                  ? t("Correction explanation", "تصحیح کی وضاحت")
                  : t("Education note (optional)", "رہنمائی کا نوٹ (اختیاری)")
              }
            >
              <textarea
                data-help="education.record"
                value={note}
                maxLength={correction ? 850 : 1000}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <button data-help="education.save" onClick={save}>
              {t("Save education record", "رہنمائی کا ریکارڈ محفوظ کریں")}
            </button>
            <button data-help="education.correction" onClick={newRecord}>
              {t("Clear / new education entry", "صاف / نیا رہنمائی اندراج")}
            </button>
          </fieldset>
        </section>
      )}
      <section className="card">
        <h2>{t("Education already recorded", "پہلے درج رہنمائی")}</h2>
        <p>
          {t(
            "Patient-record reads are logged. Signed entries are append-only; no edit or delete is offered.",
            "مریض ریکارڈ کی پڑھائی درج ہے۔ دستخط شدہ اندراج صرف اضافہ ہے؛ ترمیم یا حذف نہیں۔",
          )}
        </p>
        <LoadState {...records} retry={records.reload} />
        {!records.loading &&
          !records.error &&
          records.data?.map((r) => (
            <article key={r.education_id}>
              <h3>{r.topic}</h3>
              <p>
                <bdi>
                  #{r.education_id} · {r.mrn}
                </bdi>{" "}
                · {r.patient_name} · {time(r.given_at)}
              </p>
              <p>
                {tr(r.method)} · {tr(r.given_to)} ·{" "}
                {r.material_title || t("No material recorded", "مواد درج نہیں")}{" "}
                · {t("Encounter", "ملاقات")}:{" "}
                {r.encounter_id ?? t("Not linked", "منسلک نہیں")}
              </p>
              <p>{r.note}</p>
              <p className="notice">{r.given_by_stamp.text}</p>
              {canGive && (
                <button
                  data-help="education.correction"
                  disabled={disabled}
                  onClick={() => correct(r)}
                >
                  {t("Record a corrective entry for", "اصلاحی اندراج کریں")}{" "}
                  <bdi>#{r.education_id}</bdi>
                </button>
              )}
            </article>
          ))}
        {!records.loading && !records.error && !records.data?.length && (
          <Empty>
            {t(
              "No education entries in this page. Review a newer page or record actual guidance with permission.",
              "اس صفحے میں رہنمائی نہیں۔ نیا صفحہ یا اجازت سے اصل رہنمائی درج کریں۔",
            )}
          </Empty>
        )}
        <button
          data-help="education.pages"
          disabled={
            write.blocked ||
            records.loading ||
            !!records.error ||
            !records.data?.length
          }
          onClick={() => {
            setBack((prev) => [...prev, before]);
            setBefore(records.data!.at(-1)!.education_id);
          }}
        >
          {t("Older education entries", "پرانے رہنمائی اندراج")}
        </button>
        <button
          data-help="education.pages"
          disabled={write.blocked || records.loading || !back.length}
          onClick={() => {
            setBefore(back.at(-1));
            setBack((prev) => prev.slice(0, -1));
          }}
        >
          {t("Newer education entries", "نئے رہنمائی اندراج")}
        </button>
      </section>
      <details>
        <summary data-help="education.material">
          {t("Education material catalogue", "رہنمائی مواد کی فہرست")}
        </summary>
        <Field label={t("Filter education materials", "رہنمائی مواد میں تلاش")}>
          <input
            data-help="education.material"
            value={materialFilter}
            maxLength={100}
            onChange={(e) => setMaterialFilter(e.target.value)}
          />
        </Field>
        {!materials.loading &&
          !materials.error &&
          materials.data
            ?.filter((m) =>
              `${m.title} ${m.topic} ${m.language} ${m.kind}`
                .toLowerCase()
                .includes(materialFilter.toLowerCase()),
            )
            .map((m) => (
              <article key={m.material_id}>
                <strong>{m.title}</strong>
                <p>
                  {m.topic} · {tr(m.kind)} · {tr(m.language)} ·{" "}
                  {m.displayed_at || t("Location not recorded", "جگہ درج نہیں")}
                </p>
              </article>
            ))}
        {!materials.loading && !materials.error && !!materials.data?.length && !materials.data.some(m=>`${m.title} ${m.topic} ${m.language} ${m.kind}`.toLowerCase().includes(materialFilter.toLowerCase())) && <Empty>{t('No material matches this filter. Clear the filter to review the catalogue.','اس تلاش سے مواد نہیں ملا۔ پوری فہرست کے لیے تلاش صاف کریں۔')}</Empty>}
        {!materials.loading && !materials.error && !materials.data?.length && (
          <Empty>
            {t(
              "No education materials are available. Ask authorized quality/setup staff; do not invent a leaflet or video.",
              "رہنمائی مواد دستیاب نہیں۔ مجاز کوالٹی/ترتیب عملے سے کہیں؛ فرضی پرچہ یا ویڈیو نہ بنائیں۔",
            )}
          </Empty>
        )}
      </details>
      <p>
        {t(
          "There is no patient education certificate or material-download endpoint here. Use the actual supplied materials; Help can print this guide.",
          "یہاں مریض کا سرٹیفکیٹ یا مواد کی فائل لینے کا معاہدہ نہیں۔ اصل فراہم کردہ مواد استعمال کریں؛ مدد سے یہ رہنما پرنٹ ہوتا ہے۔",
        )}
      </p>
    </section>
  );
}
