import { useEffect, useState } from "react";
import { ApiError } from "../bridge";
import {
  Details,
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
import {
  formatHospitalTime,
  hospitalTimeInput,
  hospitalTimeToUtc,
} from "../hospital-time";
import * as a from "../generated/vitals_tracker";
import {
  vitalFields,
  vitalBody,
  flowsheetWritable,
  scheduleSnapshot,
} from "../vitals-policy";
type Draft = {
  kind: "vitals" | "note" | "schedule";
  source?: number;
  values: Record<string, string>;
  text: string;
  reason: string;
  timeMode: "server" | "entered" | "original";
  time: string;
  originalTime?: string;
  interval: string;
  scheduleBase: string;
  ack: boolean;
};
type Review = {
  method: "POST" | "PUT";
  path: string;
  body:
    | a.VitalsIn
    | a.VitalsCorrectionIn
    | a.NursingNoteIn
    | a.NoteCorrectionIn
    | a.VitalsScheduleIn;
};
export function VitalsFlowsheet(props: WardProps) {
  return (
    <section>
      <h1>{t("Vitals flowsheet", "حیاتیاتی پیمائش کا چارٹ")}</h1>
      <p>
        {t(
          "During the ward round, verify the patient before recording observations or a nursing note. Saved entries remain in the record; corrections are separate entries.",
          "وارڈ معائنے میں پیمائش یا نرسنگ نوٹ درج کرنے سے پہلے مریض چیک کریں۔ محفوظ اندراج برقرار، تصحیح الگ اندراج ہے۔",
        )}
      </p>
      <WardAdmission {...props} screenId="vitals_tracker">
        {(ctx) => <FlowsheetForm {...props} ctx={ctx} />}
      </WardAdmission>
    </section>
  );
}
function FlowsheetForm({
  ctx,
  user,
  connected,
  stream,
  timeZone,
}: WardProps & { ctx: WardContext }) {
  const id = ctx.admission.admission_id,
    [tick, setTick] = useState(0),
    [draft, setDraft] = useState<Draft>(),
    [review, setReview] = useState<Review>(),
    [error, setError] = useState<unknown>(),
    [stale, setStale] = useState(false),
    [booking, setBooking] = useState<number>();
  const canRead = user.permissions.includes("ipd.flowsheet.view"),
    canOT = user.permissions.includes("ot.clinical.view"),
    live = connected && stream === "Live";
  const flow = useLoad(
    () => (canRead ? a.flowsheet(id) : Promise.resolve(undefined)),
    [id, ctx.revision, tick, canRead],
  );
  const operations = useLoad(
    () =>
      canOT ? a.worklistOtClinical({ admission_id: id }) : Promise.resolve([]),
    [id, ctx.revision, tick, canOT],
  );
  const operation = useLoad(async () => {
    if (!booking || !operations.data?.some((b) => b.booking_id === booking))
      return undefined;
    const r = await a.getRecord(booking);
    if (
      r.booking.admission_id !== id ||
      r.booking.patient_id !== ctx.patient.patient_id
    )
      throw Error(
        t(
          "Operation identity differs. Read the stay again.",
          "آپریشن کی شناخت مختلف۔ داخلہ پھر پڑھیں۔",
        ),
      );
    return r;
  }, [booking, operations.data, id, tick]);
  const writable = (schedule = false, correction = false) =>
    ctx.ready &&
    live &&
    !flow.loading &&
    !flow.error &&
    flowsheetWritable(
      ctx.view,
      ctx.admission.status,
      user.permissions,
      schedule,
      correction,
    );
  const write = useClinicalWrite(
    user,
    "vitals_tracker:" + id,
    async (result, command) => {
      if (
        result.admission_id !== id ||
        ("patient_id" in result && result.patient_id !== ctx.patient.patient_id)
      )
        throw Error(
          "Flowsheet response identity differs; read before another action",
        );
      setDraft(undefined);
      setReview(undefined);
      setStale(false);
      setTick((n) => n + 1);
    },
  );
  const stamp = (s: string | null | undefined) =>
    s
      ? timeZone
        ? formatHospitalTime(s, timeZone)
        : s
      : t("Not recorded", "درج نہیں");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = window.terminal.subscribe((v) => {
      const relevant =
        v.type === "event" &&
        ((v.event_type === "vitals.due" && v.payload?.admission_id === id) ||
          ["ot.clinical.updated", "ot.booking.updated"].includes(
            v.event_type || "",
          ));
      if (
        relevant ||
        (v.type === "stream" && v.status === "Live" && v.resync)
      ) {
        setReview(undefined);
        setStale(true);
        clearTimeout(timer);
        timer = setTimeout(() => setTick((n) => n + 1), 150);
      }
    });
    return () => {
      stop();
      clearTimeout(timer);
    };
  }, [id]);
  useEffect(() => {
    if (write.error) {
      setReview(undefined);
      if (
        write.error instanceof ApiError &&
        ["ADMISSION_STATE_INVALID", "FLOWSHEET_CORRECTION_INVALID"].includes(
          write.error.response.error?.code || "",
        )
      ) {
        setStale(true);
        setTick((n) => n + 1);
        void ctx.reload();
      }
    }
  }, [write.error]);
  useEffect(() => {
    if (!draft) return;
    const f = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [draft]);
  function begin(
    kind: Draft["kind"],
    source?: a.FlowsheetVitalsOut | a.FlowsheetNoteOut,
  ) {
    if (
      !writable(kind === "schedule", !!source) ||
      write.blocked ||
      (draft &&
        !window.confirm(
          t(
            "Discard this unsent flowsheet draft?",
            "یہ غیر ارسال چارٹ مسودہ چھوڑ دیں؟",
          ),
        ))
    )
      return;
    const values = Object.fromEntries(
      vitalFields.map(([key]) => [
        key,
        source && key in source
          ? String((source as unknown as Record<string, unknown>)[key] ?? "")
          : "",
      ]),
    );
    setDraft({
      kind,
      source: source
        ? "entry_id" in source
          ? source.entry_id
          : source.note_id
        : undefined,
      values,
      text: source
        ? "note_text" in source
          ? source.note_text
          : source.notes || ""
        : "",
      reason: "",
      timeMode: source ? "original" : "server",
      time: "",
      originalTime: source?.observed_at,
      interval: String(flow.data?.schedule?.interval_minutes ?? ""),
      scheduleBase: scheduleSnapshot(flow.data?.schedule),
      ack: false,
    });
    setReview(undefined);
    setError(undefined);
    write.clearError();
    setStale(false);
  }
  const change = (patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setReview(undefined);
  };
  function prepare() {
    if (
      !draft ||
      !writable(draft.kind === "schedule", !!draft.source) ||
      !draft.ack ||
      stale
    )
      return;
    setError(undefined);
    try {
      let body: Review["body"],
        path = `/admissions/${id}/flowsheet/`;
      if (draft.kind === "schedule") {
        const interval = Number(draft.interval);
        if (!Number.isInteger(interval) || interval < 15 || interval > 1440)
          throw Error(
            t(
              "Interval must be a whole 15–1440 minutes.",
              "وقفہ پورے15تا1440منٹ ہو۔",
            ),
          );
        body = { interval_minutes: interval };
        path += "vitals-schedule";
      } else {
        const observed_at =
          draft.timeMode === "server"
            ? null
            : draft.timeMode === "original"
              ? draft.originalTime!
              : hospitalTimeToUtc(draft.time, timeZone || "");
        if (draft.source && draft.reason.trim().length < 3)
          throw Error(
            t(
              "A correction needs a reason of 3–500 characters.",
              "تصحیح کی وجہ3تا500حروف لازم۔",
            ),
          );
        if (draft.kind === "vitals") {
          const values = vitalBody(draft.values);
          if (Object.values(values).every((v) => v === null))
            throw Error(
              t(
                "Enter at least one actual measurement.",
                "کم از کم ایک اصل پیمائش درج کریں۔",
              ),
            );
          body = { ...values, notes: draft.text.trim() || null, observed_at };
          path += "vitals";
        } else {
          if (!draft.text.trim())
            throw Error(
              t("Enter the actual nursing note.", "اصل نرسنگ نوٹ درج کریں۔"),
            );
          body = { note_text: draft.text.trim(), observed_at };
          path += "nursing-notes";
        }
        if (draft.source) {
          path += `/${draft.source}/correction`;
          body = { ...body, correction_reason: draft.reason.trim() };
        }
      }
      setReview({
        method: draft.kind === "schedule" ? "PUT" : "POST",
        path,
        body,
      });
    } catch (e) {
      setError(e);
    }
  }
  function confirm() {
    if (
      !draft ||
      !review ||
      stale ||
      write.blocked ||
      !writable(draft.kind === "schedule", !!draft.source)
    )
      return;
    const d = draft;
    write.start(
      {
        ...review,
        permission:
          d.kind === "schedule"
            ? user.permissions.includes("ipd.flowsheet.record")
              ? "ipd.flowsheet.record"
              : "ipd.admission.request"
            : "ipd.flowsheet.record",
        protection: d.kind === "schedule" ? "reconcile" : "idempotent",
        reconcilePath: `/admissions/${id}/flowsheet`,
        label: t("Record flowsheet entry", "چارٹ اندراج درج کریں"),
      },
      async () => {
        await ctx.preflight(
          d.kind === "schedule"
            ? user.permissions.includes("ipd.flowsheet.record")
              ? "ipd.flowsheet.record"
              : "ipd.admission.request"
            : "ipd.flowsheet.record",
          !!d.source,
        );
        const fresh = await a.flowsheet(id);
        if (
          d.kind === "schedule" &&
          scheduleSnapshot(fresh.schedule) !== d.scheduleBase
        ) {
          flow.setData(fresh);
          setStale(true);
          setReview(undefined);
          throw Error(
            t(
              "The schedule changed. Input kept; compare the current interval before another review.",
              "شیڈول بدلا۔ معلومات محفوظ؛ نئے جائزے سے پہلے موجودہ وقفہ ملائیں۔",
            ),
          );
        }
        if (
          d.source &&
          !(d.kind === "vitals"
            ? fresh.vitals.some(
                (r) =>
                  r.entry_id === d.source &&
                  r.admission_id === id &&
                  r.patient_id === ctx.patient.patient_id,
              )
            : fresh.nursing_notes.some(
                (r) =>
                  r.note_id === d.source &&
                  r.admission_id === id &&
                  r.patient_id === ctx.patient.patient_id,
              ))
        )
          throw Error(
            t(
              "The correction source is unavailable for this patient. Read current records.",
              "اس مریض کا اصل اندراج دستیاب نہیں۔ تازہ ریکارڈ پڑھیں۔",
            ),
          );
      },
    );
  }
  const d = flow.data,
    correctedVitals = new Set(
      d?.vitals.map((r) => r.corrects_entry_id).filter(Boolean),
    ),
    correctedNotes = new Set(
      d?.nursing_notes.map((r) => r.corrects_note_id).filter(Boolean),
    );
  return (
    <section
      className="vitals-flowsheet"
      data-write-pending={write.blocked}
      data-unsaved={!!draft}
    >
      <ErrorBox error={error} />
      <ClinicalWriteFeedback
        key={review ? "review" : "input"}
        write={write}
        onReviewed={() => {
          setStale(true);
          setTick((n) => n + 1);
        }}
      />
      <LoadState {...flow} retry={flow.reload} />
      {!canRead && (
        <p>
          {t(
            "You cannot read this flowsheet with current permissions.",
            "موجودہ اجازت سے یہ چارٹ پڑھ نہیں سکتے۔",
          )}
        </p>
      )}
      <button
        data-help="vitals.read"
        disabled={write.blocked}
        onClick={() => {
          setTick((n) => n + 1);
          if (draft) {
            setStale(true);
            setReview(undefined);
          }
        }}
      >
        {t("Refresh flowsheet", "چارٹ تازہ کریں")}
      </button>
      {d && !flow.loading && !flow.error && (
        <>
          <section className="card">
            <h2>{t("Vitals schedule", "پیمائش کا شیڈول")}</h2>
            <p>
              {t("Current interval (minutes)", "موجودہ وقفہ (منٹ)")}:{" "}
              {d.schedule?.interval_minutes ?? t("Not recorded", "درج نہیں")} ·{" "}
              {t("Next vitals due", "اگلی پیمائش")}:{" "}
              {stamp(d.next_vitals_due_at)}
            </p>
            <p className={d.is_overdue ? "error" : ""}>
              {d.is_overdue
                ? t("Overdue", "تاخیر")
                : t("Not overdue", "تاخیر نہیں")}
            </p>
            <div className="actions">
              <button
                data-help="vitals.record"
                disabled={write.blocked || !writable()}
                onClick={() => begin("vitals")}
              >
                {t("Record vitals", "پیمائش درج کریں")}
              </button>
              <button
                data-help="vitals.note"
                disabled={write.blocked || !writable()}
                onClick={() => begin("note")}
              >
                {t("Record nursing note", "نرسنگ نوٹ درج کریں")}
              </button>
              <button
                data-help="vitals.schedule"
                disabled={write.blocked || !writable(true)}
                onClick={() => begin("schedule")}
              >
                {t("Change vitals interval", "پیمائش وقفہ بدلیں")}
              </button>
            </div>
          </section>
          <section className="card">
            <h2>{t("Recorded vitals", "درج پیمائشیں")}</h2>
            {!d.vitals.length && (
              <p>{t("No vitals recorded.", "پیمائش درج نہیں۔")}</p>
            )}
            <div className="vitals-grid">
              <table>
                <thead>
                  <tr>
                    <th>{t("Observed", "پیمائش وقت")}</th>
                    {vitalFields.map(([key, en, ur]) => (
                      <th key={key}>{t(en, ur)}</th>
                    ))}
                    <th>
                      {t("Notes / correction / author", "نوٹ / تصحیح / مصنف")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {d.vitals.map((r) => (
                    <tr
                      key={r.entry_id}
                      data-corrected={correctedVitals.has(r.entry_id)}
                    >
                      <td>{stamp(r.observed_at)}</td>
                      {vitalFields.map(([key]) => (
                        <td key={key}>
                          {correctedVitals.has(r.entry_id) ? (
                            <del>{r[key] ?? "—"}</del>
                          ) : (
                            (r[key] ?? "—")
                          )}
                        </td>
                      ))}
                      <td>
                        <p>{r.notes}</p>
                        {r.is_correction && (
                          <p>
                            {t("Correction of", "تصحیح")}: #
                            {r.corrects_entry_id} · {r.correction_reason}
                          </p>
                        )}
                        <p>
                          {r.recorded_by_name} · {stamp(r.recorded_at)}
                        </p>
                        <button
                          data-help="vitals.correct"
                          disabled={write.blocked || !writable(false, true)}
                          onClick={() => begin("vitals", r)}
                        >
                          {t("Correct vitals", "پیمائش کی تصحیح")} #{r.entry_id}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card">
            <h2>{t("Nursing notes", "نرسنگ نوٹ")}</h2>
            {!d.nursing_notes.length && (
              <p>{t("No nursing notes recorded.", "نرسنگ نوٹ درج نہیں۔")}</p>
            )}
            {d.nursing_notes.map((r) => (
              <article key={r.note_id}>
                <p>{stamp(r.observed_at)}</p>
                {correctedNotes.has(r.note_id) ? (
                  <del>{r.note_text}</del>
                ) : (
                  <p>{r.note_text}</p>
                )}
                {r.is_correction && (
                  <p>
                    {t("Correction of", "تصحیح")}: #{r.corrects_note_id} ·{" "}
                    {r.correction_reason}
                  </p>
                )}
                <p>{r.author_stamp.text}</p>
                <button
                  data-help="vitals.correct"
                  disabled={write.blocked || !writable(false, true)}
                  onClick={() => begin("note", r)}
                >
                  {t("Correct nursing note", "نرسنگ نوٹ کی تصحیح")} #{r.note_id}
                </button>
              </article>
            ))}
          </section>
        </>
      )}
      <section className="card">
        <h2>{t("Postoperative plan", "آپریشن کے بعد کا منصوبہ")}</h2>
        {!canOT ? (
          <p>
            {t(
              "Operation records are unavailable to this account. Ask the responsible theatre team.",
              "آپریشن ریکارڈ اس اکاؤنٹ کو دستیاب نہیں۔ متعلقہ ٹیم سے کہیں۔",
            )}
          </p>
        ) : (
          <>
            <LoadState {...operations} retry={operations.reload} />
            {!operations.loading &&
              !operations.error &&
              !operations.data?.length && (
                <p>
                  {t(
                    "No operations returned for this stay.",
                    "اس داخلے کا آپریشن واپس نہیں آیا۔",
                  )}
                </p>
              )}
            {operations.data?.map((o) => (
              <button
                data-help="vitals.operation"
                key={o.booking_id}
                disabled={write.blocked}
                onClick={() => setBooking(o.booking_id)}
              >
                {o.booking_number} · {o.procedure_name} · {o.status}
              </button>
            ))}
            <LoadState {...operation} retry={operation.reload} />
            {operation.data?.operative_note ? (
              <section>
                <p>
                  {operation.data.booking.booking_number} ·{" "}
                  {operation.data.operative_note.status}
                </p>
                {operation.data.operative_note.status !== "Final" && (
                  <p className="notice">
                    {t(
                      "Draft operative note; not signed instructions. Confirm the plan with the surgical team.",
                      "آپریشن نوٹ مسودہ ہے، دستخط شدہ ہدایات نہیں۔ سرجیکل ٹیم سے منصوبہ چیک کریں۔",
                    )}
                  </p>
                )}
                {(
                  [
                    "monitoring",
                    "monitoring_interval_minutes",
                    "medications",
                    "wound_care",
                    "drains_catheters",
                    "positioning",
                    "nutrition",
                    "fluid_balance",
                    "referrals",
                    "transfusion_instructions",
                  ] as const
                ).map((f, i) => (
                  <p key={f}>
                    <strong>
                      {
                        [
                          t("Monitoring", "نگرانی"),
                          t(
                            "Monitoring interval (minutes)",
                            "نگرانی وقفہ (منٹ)",
                          ),
                          t("Medicines", "دوائیں"),
                          t("Wound care", "زخم کی دیکھ بھال"),
                          t("Drains / catheters", "ڈرین / کیتھیٹر"),
                          t("Positioning", "جسم کی پوزیشن"),
                          t("Nutrition", "غذا"),
                          t("Fluid balance", "سیال کا توازن"),
                          t("Referrals", "حوالے"),
                          t("Transfusion instructions", "انتقال خون ہدایات"),
                        ][i]
                      }
                    </strong>
                    :{" "}
                    {operation.data!.operative_note![f] ??
                      t("Not recorded", "درج نہیں")}
                  </p>
                ))}
                <p>{operation.data.operative_note.author_stamp?.text}</p>
                {operation.data.corrections
                  .filter((c) => c.record === "OperativeNote")
                  .map((c) => (
                    <p key={c.correction_id}>
                      {t("Surgical correction", "سرجیکل تصحیح")}:{" "}
                      {c.correction_text} · {c.correction_reason} ·{" "}
                      {c.author_stamp.text}
                    </p>
                  ))}
              </section>
            ) : (
              booking &&
              !operation.loading &&
              !operation.error && (
                <p>
                  {t("No operative note recorded.", "آپریشن نوٹ درج نہیں۔")}
                </p>
              )
            )}
          </>
        )}
      </section>
      {draft && (
        <fieldset className="card" disabled={write.blocked || !ctx.ready}>
          <legend>
            {draft.kind === "schedule"
              ? t("Vitals interval draft", "پیمائش وقفہ مسودہ")
              : draft.source
                ? t("Correction draft", "تصحیح مسودہ")
                : t("Flowsheet draft", "چارٹ مسودہ")}
          </legend>
          {stale && (
            <p role="alert">
              {t(
                "Data changed. Read latest flowsheet and keep input before reviewing again.",
                "معلومات بدلیں۔ نیا جائزہ سے پہلے تازہ چارٹ پڑھ کر معلومات رکھیں۔",
              )}
            </p>
          )}
          {draft.kind === "schedule" ? (
            <Field label={t("Vitals interval (minutes)", "پیمائش وقفہ (منٹ)")}>
              <input
                data-help="vitals.schedule"
                data-field="interval_minutes"
                type="number"
                min={15}
                max={1440}
                step={1}
                value={draft.interval}
                onChange={(e) => change({ interval: e.target.value })}
              />
            </Field>
          ) : (
            <>
              {draft.kind === "vitals" &&
                vitalFields.map(([key, en, ur, min, max, integer]) => (
                  <Field key={key} label={t(en, ur)}>
                    <input
                      data-help="vitals.record"
                      data-field={key}
                      type="number"
                      min={min}
                      max={max}
                      step={integer ? 1 : "any"}
                      value={draft.values[key]}
                      onChange={(e) =>
                        change({
                          values: { ...draft.values, [key]: e.target.value },
                        })
                      }
                    />
                  </Field>
                ))}
              <Field
                label={
                  draft.kind === "note"
                    ? t("Nursing note text", "نرسنگ نوٹ کا متن")
                    : t("Vitals notes (optional)", "پیمائش نوٹ (اختیاری)")
                }
              >
                <textarea
                  data-help="vitals.note"
                  data-field={draft.kind === "note" ? "note_text" : "notes"}
                  maxLength={draft.kind === "note" ? 10000 : 2000}
                  value={draft.text}
                  onChange={(e) => change({ text: e.target.value })}
                />
              </Field>
              <Field
                label={t("Observation time choice", "پیمائش وقت کا انتخاب")}
              >
                <select
                  data-help="vitals.time"
                  value={draft.timeMode}
                  onChange={(e) =>
                    change({ timeMode: e.target.value as Draft["timeMode"] })
                  }
                >
                  {draft.source && (
                    <option value="original">
                      {t("Keep original observed time", "اصل پیمائش وقت رکھیں")}{" "}
                      · {stamp(draft.originalTime)}
                    </option>
                  )}
                  <option value="server">
                    {t("Server time when saved", "محفوظ ہونے پر سرور وقت")}
                  </option>
                  <option value="entered">
                    {t(
                      "Enter actual hospital date and time",
                      "ہسپتال کا اصل وقت درج کریں",
                    )}
                  </option>
                </select>
              </Field>
              {draft.timeMode === "entered" && (
                <Field
                  label={t(
                    "Observed at (hospital time)",
                    "پیمائش وقت (ہسپتال)",
                  )}
                >
                  <input
                    data-help="vitals.time"
                    data-field="observed_at"
                    type="datetime-local"
                    value={draft.time}
                    onChange={(e) => change({ time: e.target.value })}
                  />
                </Field>
              )}
              <p>
                {timeZone ||
                  t(
                    "Hospital timezone unavailable; use server time or ask IT.",
                    "ہسپتال کا وقت علاقہ نہیں؛ سرور وقت لیں یا آئی ٹی سے کہیں۔",
                  )}
              </p>
              {draft.source && (
                <Field label={t("Correction reason", "تصحیح کی وجہ")}>
                  <textarea
                    data-help="vitals.correct"
                    data-field="correction_reason"
                    minLength={3}
                    maxLength={500}
                    value={draft.reason}
                    onChange={(e) => change({ reason: e.target.value })}
                  />
                </Field>
              )}
            </>
          )}
          <label>
            <input
              data-help="vitals.review"
              type="checkbox"
              checked={draft.ack}
              onChange={(e) => change({ ack: e.target.checked })}
            />
            {t(
              "I verified this patient and the actual observation",
              "میں نے مریض و اصل مشاہدہ چیک کیا",
            )}
          </label>
          <div className="actions">
            <button
              data-help="vitals.review"
              disabled={
                !draft.ack || stale || !writable(draft.kind === "schedule", !!draft.source)
              }
              onClick={prepare}
            >
              {t("Review flowsheet entry", "چارٹ اندراج کا جائزہ")}
            </button>
            <button
              data-help="vitals.recovery"
              onClick={async () => {
                try {
                  const fresh = await a.flowsheet(id);
                  flow.setData(fresh);
                  change({
                    scheduleBase: scheduleSnapshot(fresh.schedule),
                    ack: false,
                  });
                  setStale(false);
                  await ctx.reload();
                } catch (e) {
                  setError(e);
                }
              }}
            >
              {t(
                "Read latest flowsheet and keep input",
                "تازہ چارٹ پڑھیں و معلومات رکھیں",
              )}
            </button>
            <button
              data-help="vitals.review"
              onClick={() => {
                if (
                  window.confirm(
                    t(
                      "Discard this unsent flowsheet draft?",
                      "غیر ارسال چارٹ مسودہ چھوڑ دیں؟",
                    ),
                  )
                ) {
                  setDraft(undefined);
                  setReview(undefined);
                }
              }}
            >
              {t("Close flowsheet draft", "چارٹ مسودہ بند")}
            </button>
          </div>
        </fieldset>
      )}
      {review && draft && (
        <Modal
          title={t("Review flowsheet entry", "چارٹ اندراج کا جائزہ")}
          closable={!write.blocked}
          onClose={() => setReview(undefined)}
        >
          <p>
            {ctx.patient.full_name} · <bdi>{ctx.patient.mrn}</bdi> ·{" "}
            {ctx.admission.admission_number} · {ctx.admission.ward_name}{" "}
            {ctx.admission.bed_label}
          </p>
          <Details value={review.body} />
          <div className="actions">
            <button
              data-help="vitals.review"
              disabled={
                write.blocked || stale || !writable(draft.kind === "schedule", !!draft.source)
              }
              onClick={confirm}
            >
              {t(
                "Confirm this flowsheet entry once",
                "یہ چارٹ اندراج ایک بار تصدیق کریں",
              )}
            </button>
            <button
              data-help="vitals.review"
              disabled={write.blocked}
              onClick={() => setReview(undefined)}
            >
              {t("Back to flowsheet input", "چارٹ معلومات پر واپس")}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
