import { useEffect, useState } from "react";
import { api } from "../bridge";
import { bilingual as t, tr } from "../i18n";
import { Empty, ErrorBox, Field, LoadState, useLoad } from "../components";
import {
  type ClinicalUser,
  mayChangeClinicalContext,
} from "../clinical-context";
import { ClinicalPatient, type PatientContext } from "../clinical-patient";
import { useClinicalWrite, ClinicalWriteFeedback } from "../clinical-write";
import { ReferralRecord } from "../referral-record";
import * as ref from "../generated/external_referral";
import * as emr from "../generated/consultation";
import { listVisitsEr } from "../generated/clinical_er";
type Props = {
  user: ClinicalUser;
  revision: number;
  initialTicket?: number;
  readOnly: boolean;
  connected: boolean;
  timeZone?: string;
  availableScreens: string[];
  onRoute: (screen: string, ticket?: number) => void;
};
const contactKinds = [
  "ReferralHospital",
  "TraumaCentre",
  "BloodBank",
  "MlrHospital",
];
export function ExternalReferral(props: Props) {
  return (
    <section>
      <h1>{t("Refer out (external referral)", "بیرونی مرکز کو حوالہ")}</h1>
      <ClinicalPatient
        user={props.user}
        revision={props.revision}
        initialTicket={props.initialTicket}
      >
        {(ctx) => <ReferralForm {...props} ctx={ctx} />}
      </ClinicalPatient>
    </section>
  );
}
function ReferralForm({
  ctx,
  user,
  revision,
  readOnly,
  connected,
  timeZone,
  availableScreens,
  onRoute,
}: Props & { ctx: PatientContext }) {
  const can = (p: string) => user.permissions.includes(p),
    [local, setLocal] = useState(0),
    [selected, setSelected] = useState<number>(),
    [before, setBefore] = useState<number>(),
    [created, setCreated] = useState<ref.ReferralOut[]>([]),
    [source, setSource] = useState<"OPD" | "ER">(ctx.ticket ? "OPD" : "ER"),
    [erId, setErId] = useState(""),
    [noteId, setNoteId] = useState(""),
    [contact, setContact] = useState(""),
    [patientRequest, setPatientRequest] = useState(false),
    [name, setName] = useState(""),
    [department, setDepartment] = useState(""),
    [reason, setReason] = useState(""),
    [urgency, setUrgency] = useState(""),
    [summary, setSummary] = useState(""),
    [summaryConfirmed, setSummaryConfirmed] = useState(false),
    [treatment, setTreatment] = useState(""),
    [transport, setTransport] = useState(""),
    [escort, setEscort] = useState(""),
    [care, setCare] = useState(""),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState<unknown>();
  const history = useLoad(()=>api<ref.ReferralOut[]>('GET',`/referrals?limit=200${before?`&before_id=${before}`:''}`),[revision,local,before]);
  const visibleHistory=[...new Map([...created,...(history.data||[]).filter(r=>r.patient_id===ctx.patient.patient_id)].map(r=>[r.referral_id,r])).values()];
  const contacts = useLoad(
    () =>
      user.permissions.some((p) =>
        ["mlc.case.manage", "mlc.register.view", "mlc.setup.manage"].includes(
          p,
        ),
      )
        ? ref.contacts({ include_inactive: false })
        : Promise.resolve([]),
    [revision, local],
  );
  const encounters = useLoad(
    () =>
      can("clinical.encounter.view")
        ? emr.forPatientPatientsClinicalEncounters(ctx.patient.patient_id)
        : Promise.resolve([]),
    [ctx.patient.patient_id, revision, local],
  );
  const erVisits = useLoad(
    () =>
      can("er.visit.view")
        ? listVisitsEr({
            patient_id: ctx.patient.patient_id,
            open_only: true,
            limit: 1000,
          })
        : Promise.resolve([]),
    [ctx.patient.patient_id, revision, local],
  );
  const er = erVisits.data?.find(
    (v) =>
      v.er_visit_id === Number(erId) && v.patient_id === ctx.patient.patient_id,
  );
  const noteRecord = useLoad(
    () =>
      noteId
        ? emr.getClinicalEncounters(Number(noteId))
        : Promise.resolve(undefined),
    [noteId, revision],
  );
  const eligibleNotes = (encounters.data || []).filter(
    (n) =>
      n.patient_id === ctx.patient.patient_id &&
      !n.admission_id &&
      n.status !== "Cancelled" &&
      (source === "ER"
        ? !!er?.ticket_id && n.ticket_id === er.ticket_id
        : ctx.ticket
          ? n.ticket_id === ctx.ticket.ticket_id
          : !!n.ticket_id),
  );
  useEffect(() => {
    if (selected || noteId || dirty || source !== "OPD" || !ctx.ticket) return;
    const own = eligibleNotes.filter(
      (n) => n.status === "Final" && n.doctor_id === user.employee_id,
    );
    if (own.length === 1) setNoteId(String(own[0].encounter_id));
  }, [encounters.data, selected, source]);
  useEffect(() => {
    const n = noteRecord.data;
    if (
      selected ||
      !n ||
      n.encounter_id !== Number(noteId) ||
      n.patient_id !== ctx.patient.patient_id ||
      dirty
    )
      return;
    setSummary(
      [n.chief_complaint, n.examination, n.diagnosis]
        .filter(Boolean)
        .join("\n\n"),
    );
    setSummaryConfirmed(false);
  }, [noteRecord.data, selected]);
  const write = useClinicalWrite(
    user,
    `referral-source:${ctx.patient.patient_id}:${source}:${erId}:${ctx.ticket?.ticket_id || noteRecord.data?.ticket_id || ""}`,
    async (value) => {
      const result = value as ref.ReferralOut;
      setCreated((prev) => [
        result,
        ...prev.filter((r) => r.referral_id !== result.referral_id),
      ]);
      setSelected(result.referral_id);
      setDirty(false);
      setLocal((n) => n + 1);
      await ctx.reload();
    },
  );
  const disabled =
    readOnly ||
    !connected ||
    !ctx.ready ||
    ctx.patient.is_deceased ||
    !!ctx.patient.merged_into_id ||
    write.blocked ||
    !can("referral.create") ||
    (source === "OPD" &&
      !!ctx.ticket &&
      (ctx.ticket.is_clinical_locked || ctx.ticket.approval_lock !== "None"));
  function issue() {
    setError(undefined);
    if (disabled) return;
    try {
      const n = noteRecord.data;
      if (source === "ER" && !er)
        throw new Error(
          t(
            "Choose the actual open emergency visit of this patient.",
            "اسی مریض کی اصل کھلی ایمرجنسی ملاقات چنیں۔",
          ),
        );
      const ticketId =
        source === "OPD" ? ctx.ticket?.ticket_id || n?.ticket_id : undefined;
      if (source === "OPD" && !ticketId)
        throw new Error(
          t(
            "Open an OPD slip or choose a clinical note with its real outpatient visit.",
            "پرچی کھولیں یا اصل بیرونی ملاقات والا نوٹ چنیں۔",
          ),
        );
      if (
        noteId &&
        (!n ||
          noteRecord.loading ||
          noteRecord.error ||
          !eligibleNotes.some((v) => v.encounter_id === n.encounter_id))
      )
        throw new Error(
          t(
            "Re-read the selected note and confirm that it belongs to this source visit.",
            "منتخب نوٹ تازہ پڑھ کر اسی ملاقات سے تعلق چیک کریں۔",
          ),
        );
      if (!contact && (!patientRequest || !name.trim()))
        throw new Error(
          t(
            "Choose a receiving contact, or name the facility specifically at the patient’s request.",
            "وصول کنندہ رابطہ چنیں یا مریض کی درخواست پر مرکز کا نام دیں۔",
          ),
        );
      if (
        contact &&
        !contacts.data?.some(
          (c) =>
            c.contact_id === Number(contact) &&
            c.is_active &&
            contactKinds.includes(c.contact_type),
        )
      )
        throw new Error(
          t(
            "Choose a current referral-facility contact.",
            "موجودہ حوالہ مرکز کا رابطہ چنیں۔",
          ),
        );
      if (
        reason.trim().length < 3 ||
        summary.trim().length < 3 ||
        !urgency ||
        !transport ||
        !summaryConfirmed ||
        (transport === "WithStaff" && !escort.trim())
      )
        throw new Error(
          t(
            "Complete the reason, urgency, reviewed clinical summary and transport. With our staff requires the escort’s name.",
            "وجہ، ترجیح، چیک شدہ طبی خلاصہ اور نقل و حمل مکمل کریں۔ ہمارے عملے کے ساتھ میں ساتھ جانے والے کا نام لازم ہے۔",
          ),
        );
      const body: ref.ReferralIn = {
        ticket_id: ticketId || null,
        er_visit_id: source === "ER" ? er!.er_visit_id : null,
        encounter_id: noteId ? Number(noteId) : null,
        destination_contact_id: contact ? Number(contact) : null,
        destination_name: !contact ? name.trim() : null,
        destination_department: department || null,
        reason: reason.trim(),
        urgency: urgency as ref.ReferralIn["urgency"],
        clinical_summary: summary.trim(),
        treatment_given: treatment || null,
        at_patient_request: patientRequest,
        transport: transport as ref.ReferralIn["transport"],
        escort_name: transport === "WithStaff" ? escort.trim() : null,
        care_during_transfer: care || null,
      };
      write.start(
        {
          method: "POST",
          path: "/referrals",
          body,
          permission: "referral.create",
          protection: "idempotent",
          label: t("Issue external referral", "بیرونی حوالہ جاری کریں"),
        },
        async () => {
          const [patient, me] = await Promise.all([
            api<any>("GET", `/patients/${ctx.patient.patient_id}`),
            api<any>("GET", "/auth/me"),
          ]);
          if (
            patient.patient_id !== ctx.patient.patient_id ||
            patient.merged_into_id ||
            patient.is_deceased ||
            me.user_id !== user.user_id ||
            !me.permissions.includes("referral.create")
          )
            throw new Error(
              t(
                "Patient identity or permission changed; reconcile before issuing.",
                "شناخت یا اجازت بدل گئی؛ جاری کرنے سے پہلے چیک کریں۔",
              ),
            );
          if (ticketId) {
            const ticket = await api<emr.OpdTicketDetailOut>(
              "GET",
              `/opd-tickets/${ticketId}`,
            );
            if (
              ticket.patient_id !== ctx.patient.patient_id ||
              ticket.is_clinical_locked ||
              ticket.approval_lock !== "None"
            )
              throw new Error(
                ticket.clinical_lock_reason ||
                  t(
                    "The source visit is unavailable for a referral.",
                    "اصل ملاقات پر حوالہ دستیاب نہیں۔",
                  ),
              );
          }
          if (source === "ER") {
            const visits = await listVisitsEr({
              patient_id: ctx.patient.patient_id,
              open_only: true,
              limit: 1000,
            });
            const actual = visits.find(
              (v) => v.er_visit_id === er!.er_visit_id,
            );
            if (!actual || actual.admission_id)
              throw new Error(
                t(
                  "The ER source changed or became an inpatient. Use the admission transfer workflow for inpatients.",
                  "ایمرجنسی بدل گئی یا مریض داخل ہو گیا۔ داخل مریض کی منتقلی کا طریقہ لیں۔",
                ),
              );
            if (actual.ticket_id) {
              const ticket = await api<emr.OpdTicketDetailOut>(
                "GET",
                `/opd-tickets/${actual.ticket_id}`,
              );
              if (ticket.is_clinical_locked || ticket.approval_lock !== "None")
                throw new Error(
                  ticket.clinical_lock_reason ||
                    t(
                      "The emergency ticket is locked.",
                      "ایمرجنسی پرچی مقفل ہے۔",
                    ),
                );
            }
          }
          if (
            contact &&
            !(await ref.contacts({ include_inactive: false })).some(
              (c) =>
                c.contact_id === Number(contact) &&
                c.is_active &&
                contactKinds.includes(c.contact_type),
            )
          )
            throw new Error(
              t(
                "The receiving contact changed; select it again.",
                "وصول کنندہ رابطہ بدل گیا؛ دوبارہ چنیں۔",
              ),
            );
        },
      );
    } catch (e) {
      setError(e);
    }
  }
  function newReferral() {
    if (!mayChangeClinicalContext()) return;
    setSelected(undefined);
    setReason("");
    setSummary("");
    setSummaryConfirmed(false);
    setTreatment("");
    setContact("");
    setName("");
    setDepartment("");
    setPatientRequest(false);
    setUrgency("");
    setTransport("");
    setEscort("");
    setCare("");
    setDirty(false);
    setNoteId("");
  }
  return (
    <section data-write-pending={write.blocked ? "true" : "false"}>
      <ErrorBox error={error} verbatim />
      <ClinicalWriteFeedback write={write} />
      <p>
        {t(
          "External referral means another facility. Internal re-routing belongs to the doctor queue. An inpatient uses the admission’s transfer/referral workflow.",
          "بیرونی حوالہ دوسرے مرکز کو ہے۔ اندرونی منتقلی ڈاکٹر کی قطار میں۔ داخل مریض اپنے داخلے کی منتقلی/حوالہ استعمال کرتا ہے۔",
        )}
      </p>
      <div className="toolbar">
        <button
          data-help="referral.record"
          disabled={write.blocked}
          onClick={newReferral}
        >
          {t("New external referral", "نیا بیرونی حوالہ")}
        </button>
        {availableScreens.includes("referral_register") && (
          <button
            data-help="referral.record"
            disabled={write.blocked}
            onClick={() => onRoute("referral_register", ctx.ticket?.ticket_id)}
          >
            {t("Open referral register", "حوالہ رجسٹر کھولیں")}
          </button>
        )}
        {visibleHistory.map((r) => (
          <button
            data-help="referral.record"
            disabled={write.blocked}
            key={r.referral_id}
            onClick={() => {
              if (mayChangeClinicalContext()) {
                setSelected(r.referral_id);
                setDirty(false);
              }
            }}
          >
            {r.referral_number}
          </button>
        ))}
      </div>
      <LoadState {...history} retry={history.reload}/>
      <p>{t('Patient referrals from the current hospital page (last 12 months by default). Older pages may have no matching patient; continue until an empty hospital page.','ہسپتال کے موجودہ صفحے سے اس مریض کے حوالے (عام طور پر آخری12ماہ)۔ پرانے صفحے میں مریض نہ ہو تو خالی صفحے تک جاری رکھیں۔')}</p>
      <button data-help="referral.history" disabled={write.blocked||history.loading||!!history.error||!history.data?.length} onClick={()=>{if(mayChangeClinicalContext())setBefore(history.data!.at(-1)!.referral_id)}}>{t('Load older referral page','حوالوں کا پرانا صفحہ لائیں')}</button>
      {before&&<button data-help="referral.history" disabled={write.blocked} onClick={()=>{if(mayChangeClinicalContext())setBefore(undefined)}}>{t('Newest referral page','حوالوں کا نیا صفحہ')}</button>}
      {!history.loading&&!history.error&&!visibleHistory.length&&<Empty>{t('No referrals for this patient in this page. Load an older page or use the permitted register for a wider period.','اس صفحے میں اس مریض کا حوالہ نہیں۔ پرانا صفحہ یا وسیع مدت کے لیے مجاز رجسٹر کھولیں۔')}</Empty>}
      {selected ? (
        <ReferralRecord
          key={selected}
          id={selected}
          user={user}
          revision={revision + local}
          readOnly={readOnly}
          connected={connected}
          timeZone={timeZone}
          blocked={write.blocked}
          onChanged={()=>setLocal(n=>n+1)}
        />
      ) : (
        <section className="card" data-unsaved={dirty ? "true" : "false"}>
          <h2>{t("New external referral", "نیا بیرونی حوالہ")}</h2>
          <fieldset disabled={disabled} onChange={() => setDirty(true)}>
            <Field label={t("Referral source", "حوالے کا ماخذ")}>
              <select
                data-help="referral.source"
                value={source}
                onChange={(e) => {
                  if (
                    (summary || reason) &&
                    !window.confirm(
                      t(
                        "Changing the source clears the linked note and summary. Continue?",
                        "ماخذ بدلنے سے منسلک نوٹ و خلاصہ صاف ہوگا۔ جاری رکھیں؟",
                      ),
                    )
                  )
                    return;
                  setSource(e.target.value as typeof source);
                  setNoteId("");
                  setSummary("");
                  setSummaryConfirmed(false);
                }}
              >
                <option value="OPD">
                  {t("Outpatient consultation", "بیرونی مریض کا معائنہ")}
                </option>
                {can("er.visit.view") && (
                  <option value="ER">
                    {t("Emergency visit", "ایمرجنسی ملاقات")}
                  </option>
                )}
              </select>
            </Field>
            {source === "ER" && (
              <>
                <LoadState {...erVisits} retry={erVisits.reload} />
                <Field
                  label={t("Emergency source visit", "اصل ایمرجنسی ملاقات")}
                >
                  <select
                    data-help="referral.source"
                    value={erId}
                    onChange={(e) => {
                      setErId(e.target.value);
                      setNoteId("");
                      setSummary("");
                      setSummaryConfirmed(false);
                    }}
                  >
                    <option value="">
                      {t(
                        "Choose actual emergency visit",
                        "اصل ایمرجنسی ملاقات چنیں",
                      )}
                    </option>
                    {erVisits.data
                      ?.filter(
                        (v) =>
                          v.patient_id === ctx.patient.patient_id &&
                          !v.admission_id,
                      )
                      .map((v) => (
                        <option key={v.er_visit_id} value={v.er_visit_id}>
                          {v.er_number} · {tr(v.stage)} ·{" "}
                          {v.presenting_complaint}
                        </option>
                      ))}
                  </select>
                </Field>
                {!erVisits.loading &&
                  !erVisits.error &&
                  !erVisits.data?.some((v) => !v.admission_id) && (
                    <Empty>
                      {t(
                        "No eligible open emergency visit for this patient.",
                        "اس مریض کی موزوں کھلی ایمرجنسی ملاقات نہیں۔",
                      )}
                    </Empty>
                  )}
              </>
            )}
            <LoadState {...encounters} retry={encounters.reload} />
            <Field label={t("Referral consultation note", "حوالے کا طبی نوٹ")}>
              <select
                data-help="referral.summary"
                value={noteId}
                onChange={(e) => {
                  setNoteId(e.target.value);
                  setSummaryConfirmed(false);
                }}
              >
                <option value="">
                  {t(
                    "No note selected — write and confirm the summary",
                    "نوٹ منتخب نہیں؛ خلاصہ لکھ کر چیک کریں",
                  )}
                </option>
                {eligibleNotes.map((n) => (
                  <option key={n.encounter_id} value={n.encounter_id}>
                    {n.encounter_id} · {tr(n.status)} · {n.chief_complaint} ·{" "}
                    {n.diagnosis}
                  </option>
                ))}
              </select>
            </Field>
            <LoadState {...noteRecord} retry={noteRecord.reload} />
            {noteRecord.data && (
              <button
                data-help="referral.summary"
                onClick={() => {
                  if (
                    summary &&
                    !window.confirm(
                      t(
                        "Replace the current clinical summary from this note?",
                        "موجودہ خلاصہ اس نوٹ سے بدلیں؟",
                      ),
                    )
                  )
                    return;
                  const n = noteRecord.data!;
                  setSummary(
                    [n.chief_complaint, n.examination, n.diagnosis]
                      .filter(Boolean)
                      .join("\n\n"),
                  );
                  setSummaryConfirmed(false);
                  setDirty(true);
                }}
              >
                {t("Use summary from selected note", "منتخب نوٹ کا خلاصہ لیں")}
              </button>
            )}
            <LoadState {...contacts} retry={contacts.reload} />
            <Field
              label={t(
                "Receiving facility contact",
                "وصول کنندہ مرکز کا رابطہ",
              )}
            >
              <select
                data-help="referral.destination"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              >
                <option value="">
                  {t(
                    "Choose contact, or patient-request facility below",
                    "رابطہ چنیں یا نیچے مریض کا مانگا مرکز",
                  )}
                </option>
                {contacts.data
                  ?.filter(
                    (c) => c.is_active && contactKinds.includes(c.contact_type),
                  )
                  .map((c) => (
                    <option key={c.contact_id} value={c.contact_id}>
                      {c.name} · {c.district} · {c.phone}
                    </option>
                  ))}
              </select>
            </Field>
            {!user.permissions.some((p) =>
              [
                "mlc.case.manage",
                "mlc.register.view",
                "mlc.setup.manage",
              ].includes(p),
            ) && (
              <p>
                {t(
                  "Contact-list access is not permitted for your account. Ask authorized setup staff; free text is only for the patient’s chosen facility.",
                  "آپ کو رابطہ فہرست کی اجازت نہیں۔ مجاز ترتیب عملے سے کہیں؛ آزاد متن صرف مریض کے مانگے مرکز کے لیے ہے۔",
                )}
              </p>
            )}
            <label>
              <input
                type="checkbox"
                data-help="referral.destination"
                checked={patientRequest}
                onChange={(e) => setPatientRequest(e.target.checked)}
              />
              {t("At the patient’s request", "مریض کی درخواست پر")}
            </label>
            {!contact && (
              <Field
                label={t(
                  "Patient-chosen facility name",
                  "مریض کے چنے مرکز کا نام",
                )}
              >
                <input
                  data-help="referral.destination"
                  value={name}
                  maxLength={200}
                  disabled={!patientRequest}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
            )}
            <Field
              label={t(
                "Destination department (optional)",
                "منزل کا شعبہ (اختیاری)",
              )}
            >
              <input
                data-help="referral.destination"
                value={department}
                maxLength={200}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </Field>
            <Field label={t("Referral reason", "حوالے کی وجہ")}>
              <textarea
                data-help="referral.summary"
                value={reason}
                minLength={3}
                maxLength={2000}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <Field label={t("Referral urgency", "حوالے کی ترجیح")}>
              <select
                data-help="referral.summary"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
              >
                <option value="">{t("Choose urgency", "ترجیح چنیں")}</option>
                {["Routine", "Urgent", "Emergency"].map((v) => (
                  <option key={v} value={v}>
                    {tr(v)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Referral clinical summary", "حوالے کا طبی خلاصہ")}>
              <textarea
                data-help="referral.summary"
                value={summary}
                minLength={3}
                maxLength={4000}
                rows={7}
                onChange={(e) => {
                  setSummary(e.target.value);
                  setSummaryConfirmed(false);
                }}
              />
            </Field>
            <label>
              <input
                type="checkbox"
                data-help="referral.summary"
                checked={summaryConfirmed}
                onChange={(e) => setSummaryConfirmed(e.target.checked)}
              />
              {t(
                "I reviewed and confirm the complaint, findings and provisional diagnosis for this referral.",
                "اس حوالے کے لیے شکایت، معائنہ اور ابتدائی تشخیص پڑھ کر تصدیق کی ہے۔",
              )}
            </label>
            <Field
              label={t(
                "Treatment actually given (optional)",
                "واقعی دیا ہوا علاج (اختیاری)",
              )}
            >
              <textarea
                data-help="referral.summary"
                value={treatment}
                maxLength={4000}
                onChange={(e) => setTreatment(e.target.value)}
              />
            </Field>
            <Field label={t("Referral transport", "حوالے کی نقل و حمل")}>
              <select
                data-help="referral.transport"
                value={transport}
                onChange={(e) => setTransport(e.target.value)}
              >
                <option value="">
                  {t("Choose transport", "نقل و حمل چنیں")}
                </option>
                {["Own", "Ambulance", "Rescue", "WithStaff"].map((v) => (
                  <option key={v} value={v}>
                    {tr(v)}
                  </option>
                ))}
              </select>
            </Field>
            {transport === "WithStaff" && (
              <Field label={t("Escort name", "ساتھ جانے والے کا نام")}>
                <input
                  data-help="referral.transport"
                  value={escort}
                  maxLength={200}
                  onChange={(e) => setEscort(e.target.value)}
                />
              </Field>
            )}
            <Field
              label={t(
                "Care during transfer (optional)",
                "منتقلی میں نگہداشت (اختیاری)",
              )}
            >
              <textarea
                data-help="referral.transport"
                value={care}
                maxLength={2000}
                onChange={(e) => setCare(e.target.value)}
              />
            </Field>
            <button data-help="referral.issue" onClick={issue}>
              {t("Issue external referral", "بیرونی حوالہ جاری کریں")}
            </button>
          </fieldset>
        </section>
      )}
    </section>
  );
}
