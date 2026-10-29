import { useEffect, useRef, useState } from "react";
import { api, ApiError, call } from "../bridge";
import {
  Details,
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { useClinicalWrite } from "../clinical-write";
import { canRetryWrite } from "../write-attempt";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import * as a from "../generated/my_beds";
import {
  flowsheet,
  getAdmission,
  type FlowsheetOut,
} from "../generated/doctor_inpatients";
import { getPatient } from "../generated/patient_search";
import { bilingual as t } from "../i18n";
import { formatHospitalTime } from "../hospital-time";
import {
  myBedKey,
  myBedSnapshot,
  myBedsReadable,
  canCleanMyBed,
  urgentBeds,
} from "../my-beds-policy";
type Draft = { bed: a.MyBedOut; cleaner?: a.StaffLookupOut; ack: boolean };
export function MyBeds({
  user,
  establishment,
  connected,
  stream,
  timeZone,
}: {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected: boolean;
  stream: string;
  timeZone?: string;
}) {
  const permissions = user.permissions,
    can = (p: string) => permissions.includes(p),
    view = establishment.views.screens.find(
      (s) => s.screen_id === "my_beds",
    )?.view;
  const readable = myBedsReadable(view, permissions),
    live = connected && stream === "Live";
  const [tick, setTick] = useState(0),
    [key, setKey] = useState(""),
    [find, setFind] = useState(""),
    [draft, setDraft] = useState<Draft>(),
    [review, setReview] = useState<a.CleanedIn>(),
    [stale, setStale] = useState(false),
    [staffQ, setStaffQ] = useState(""),
    [searchQ, setSearchQ] = useState(""),
    [error, setError] = useState<unknown>(),
    [notice, setNotice] = useState(""),
    [paperBusy, setPaperBusy] = useState(false),
    [summary, setSummary] =
      useState<a.PrintOut_DischargeSummaryPrintFieldsOut_>();
  const root = useRef<HTMLElement>(null),
    generation = useRef(0);
  const rows = useLoad(
    () => (readable ? a.myBeds() : Promise.resolve([])),
    [readable, tick],
  );
  const duties = useLoad(
    () =>
      readable && can("self.profile.view") ? a.myDuties() : Promise.resolve([]),
    [readable, tick],
  );
  const flow = useLoad(async () => {
    const result: Record<number, { data?: FlowsheetOut; error?: unknown }> = {};
    if (!readable || !can("ipd.flowsheet.view")) return result;
    const ids = [
      ...new Set(
        (rows.data || [])
          .map((b) => b.admission_id)
          .filter((id): id is number => !!id),
      ),
    ];
    await Promise.all(
      ids.map(async (id) => {
        try {
          result[id] = { data: await flowsheet(id) };
        } catch (error) {
          result[id] = { error };
        }
      }),
    );
    return result;
  }, [rows.data, readable, tick]);
  const bed =
    !rows.loading && !rows.error
      ? rows.data?.find((b) => myBedKey(b) === key)
      : undefined;
  const detail = useLoad(
    () =>
      bed?.admission_id && can("ipd.admission.view")
        ? getAdmission(bed.admission_id)
        : Promise.resolve(undefined),
    [bed?.admission_id, tick],
  );
  const admission =
    detail.data?.admission_id === bed?.admission_id ? detail.data : undefined;
  const patient = useLoad(
    () =>
      admission && can("patient.view")
        ? getPatient(admission.patient_id)
        : Promise.resolve(undefined),
    [admission?.patient_id, tick],
  );
  const person =
    patient.data?.patient_id === admission?.patient_id
      ? patient.data
      : undefined;
  const identity =
    !!person &&
    !!admission &&
    !patient.loading &&
    !detail.loading &&
    !patient.error &&
    !detail.error &&
    !person.merged_into_id &&
    admission.mrn === bed?.mrn &&
    admission.patient_id === person.patient_id;
  const staff = useLoad(
    () =>
      draft && searchQ.length >= 2
        ? a.lookupStaff({ q: searchQ, limit: 20 })
        : Promise.resolve([]),
    [searchQ, !!draft],
  );
  const write = useClinicalWrite(user, "my_beds", async (result) => {
    if (result?.bed_id !== draft?.bed.bed_id)
      throw Error(
        t(
          "Returned bed differs. Read before another action.",
          "واپس آیا بستر مختلف ہے۔ دوبارہ پڑھیں۔",
        ),
      );
    setNotice(
      result.outcome === "BedCleaned"
        ? t(
            "Cleaning recorded; the server made the bed available.",
            "صفائی درج؛ سرور نے بستر دستیاب کیا۔",
          )
        : result.outcome === "BedCleaningRecorded"
          ? t(
              "Cleaning recorded. The bed stays locked until the remaining discharge stages clear.",
              "صفائی درج۔ باقی ڈسچارج مراحل تک بستر مقفل ہے۔",
            )
          : t(
              "No bed-state change. Read the server detail below.",
              "بستر کی حالت نہیں بدلی۔ سرور کی تفصیل پڑھیں۔",
            ),
    );
    setError(undefined);
    setDraft(undefined);
    setReview(undefined);
    setTick((n) => n + 1);
  });
  const locked = write.blocked || paperBusy,
    stamp = (s: string | null | undefined) =>
      s
        ? timeZone
          ? formatHospitalTime(s, timeZone)
          : s
        : t("Not recorded", "درج نہیں");
  const refresh = () => {
    setTick((n) => n + 1);
    setSummary(undefined);
    if (draft) {
      setStale(true);
      setReview(undefined);
    }
  };
  const leave = () =>
    !locked &&
    (!draft ||
      window.confirm(
        t(
          "Discard this unsent cleaning confirmation?",
          "صفائی کی غیر ارسال تصدیق چھوڑ دیں؟",
        ),
      ));
  const choose = (b: a.MyBedOut) => {
    if (!leave()) return;
    generation.current++;
    setKey(myBedKey(b));
    setDraft(undefined);
    setReview(undefined);
    setSummary(undefined);
    setError(undefined);
    setNotice("");
    write.clearError();
    setTick((n) => n + 1);
  };
  useEffect(() => {
    root.current?.setAttribute(
      "data-unsaved",
      draft || write.blocked ? "true" : "false",
    );
  }, [draft, write.blocked]);
  useEffect(() => {
    if (!draft && !write.blocked) return;
    const f = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [draft, write.blocked]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = window.terminal.subscribe((v) => {
      if (
        (v.type === "event" &&
          [
            "vitals.due",
            "medication.due",
            "roster.changed",
            "roster.swap.updated",
            "bed.state_changed",
            "admission.discharge.stage_changed",
            "admission.overflow_assigned",
            "patient.merged",
            "death.recorded",
          ].includes(v.event_type || "")) ||
        (v.type === "stream" && v.status === "Live" && v.resync)
      ) {
        setStale(true);
        setReview(undefined);
        setSummary(undefined);
        clearTimeout(timer);
        timer = setTimeout(() => setTick((n) => n + 1), 150);
      }
    });
    return () => {
      stop();
      clearTimeout(timer);
      generation.current++;
    };
  }, []);
  const wasLive = useRef(live);
  useEffect(() => {
    if (live && !wasLive.current) refresh();
    wasLive.current = live;
  }, [live]);
  useEffect(() => {
    if (write.error) {
      setReview(undefined);
      if (
        write.error instanceof ApiError &&
        [
          "BED_STATE_INVALID",
          "ADMISSION_STATE_INVALID",
          "REFERENCE_NOT_FOUND",
        ].includes(write.error.response.error?.code || "")
      ) {
        setStale(true);
        setTick((n) => n + 1);
      }
    }
  }, [write.error]);
  const canPaper =
    identity &&
    permissions.some((p) =>
      [
        "ipd.discharge.initiate",
        "clinical.encounter.view",
        "patient.emr.view",
      ].includes(p),
    );
  async function paper(kind: "read" | "print" | "pdf") {
    if (!bed?.admission_id || !identity || locked) return;
    const id = bed.admission_id,
      n = generation.current;
    setPaperBusy(true);
    setError(undefined);
    try {
      const payload = await a.dischargeSummaryPrint(id);
      if (
        n !== generation.current ||
        payload.fields.admission.admission_id !== id ||
        payload.fields.admission.patient_id !== person!.patient_id ||
        payload.fields.admission.mrn !== bed.mrn ||
        payload.fields.summary.admission_id !== id ||
        payload.fields.summary.status !== "Final"
      )
        throw Error(
          t(
            "Summary identity or state changed. Read again.",
            "خلاصے کی شناخت یا حالت بدلی۔ دوبارہ پڑھیں۔",
          ),
        );
      setSummary(payload);
      if (kind === "print")
        await call("print-discharge-summary", {
          admissionId: id,
          bedId: bed.bed_id,
          rosterId: bed.roster_id,
          patientId: person!.patient_id,
          mrn: bed.mrn,
          expectedVersion: payload.fields.summary.row_version,
        });
      if (kind === "pdf")
        await call("clinical-pdf", {
          path: `/admissions/${id}/discharge-summary/pdf`,
        });
    } catch (e) {
      setError(e);
      if (
        e instanceof ApiError &&
        e.response.error?.code === "DISCHARGE_SUMMARY_NOT_FINAL"
      ) {
        setSummary(undefined);
        setTick((x) => x + 1);
      }
    } finally {
      setPaperBusy(false);
    }
  }
  function begin() {
    if (
      !bed ||
      !live ||
      locked ||
      !canCleanMyBed(bed, view, permissions) ||
      !leave()
    )
      return;
    setDraft({ bed, ack: false });
    setReview(undefined);
    setStale(false);
    setStaffQ("");
    setSearchQ("");
    setError(undefined);
    setNotice("");
    write.clearError();
  }
  function confirm() {
    if (!draft || !review || locked || stale || !live) return;
    const original = draft.bed;
    write.start(
      {
        method: "POST",
        path: `/beds/${original.bed_id}/mark-cleaned`,
        body: review,
        permission: "ipd.bed.mark_cleaned",
        protection: "idempotent",
        reconcilePath: "/ipd/my-beds",
        label: t("Confirm bed cleaning", "بستر کی صفائی کی تصدیق"),
      },
      async () => {
        const [fresh, actor, est] = await Promise.all([
          a.myBeds(),
          api<ClinicalUser>("GET", "/auth/me"),
          api<EstablishmentOut>("GET", "/establishment"),
        ]);
        const actual = fresh.find((b) => myBedKey(b) === myBedKey(original)),
          v = est.views.screens.find((s) => s.screen_id === "my_beds")?.view;
        if (
          actor.user_id !== user.user_id ||
          !actual ||
          myBedSnapshot(actual) !== myBedSnapshot(original) ||
          !canCleanMyBed(actual, v, actor.permissions)
        ) {
          setStale(true);
          setReview(undefined);
          setTick((n) => n + 1);
          throw Error(
            t(
              "The duty, bed or permission changed. Input kept; read current beds before another review.",
              "ڈیوٹی، بستر یا اجازت بدلی۔ معلومات محفوظ؛ نیا جائزہ لینے سے پہلے بستر پڑھیں۔",
            ),
          );
        }
      },
    );
  }
  if (!readable)
    return (
      <Empty>
        {t(
          "Rostered beds are unavailable to this account or service view.",
          "اس اکاؤنٹ یا خدمت میں مقرر بستر دستیاب نہیں۔",
        )}
      </Empty>
    );
  const overdue = Object.fromEntries(
    Object.entries(flow.data || {}).map(([id, v]) => [
      Number(id),
      v.data?.is_overdue,
    ]),
  );
  return (
    <section
      ref={root}
      className="my-beds"
      data-write-pending={locked}
      data-unsaved={!!draft}
    >
      <h1>{t("My beds this shift", "اس شفٹ میں میرے بستر")}</h1>
      <p>
        {t(
          "For the ward nurse starting a round: check your duty, then the patient. A bed is a location, not an identifier. Recording vitals and doses belongs in the authorised ward chart.",
          "معائنے سے پہلے نرس اپنی ڈیوٹی پھر مریض چیک کرے۔ بستر جگہ ہے، مریض کی شناخت نہیں۔ پیمائش و دوا کا اندراج مجاز وارڈ چارٹ میں کریں۔",
        )}
      </p>
      {view !== "full" && (
        <p className="notice">
          {view === "open_work"
            ? t(
                "No new admissions from now on. Complete existing ward work.",
                "اب نئے داخلے نہیں۔ موجودہ وارڈ کام مکمل کریں۔",
              )
            : t(
                "Records only. Cleaning confirmations are unavailable.",
                "صرف ریکارڈ۔ صفائی کی تصدیق دستیاب نہیں۔",
              )}
        </p>
      )}
      {!live && (
        <p role="status">
          {t(
            "Reconnecting or offline. Read may fail; confirmations are disabled.",
            "رابطہ بحال یا بند۔ پڑھنا ناکام ہو سکتا ہے؛ تصدیق بند ہے۔",
          )}
        </p>
      )}
      <div className="actions">
        <button data-help="mybeds.read" disabled={locked} onClick={refresh}>
          {t("Refresh my beds", "میرے بستر تازہ کریں")}
        </button>
        <Field label={t("Find in my beds", "میرے بستروں میں تلاش")}>
          <input
            data-help="mybeds.read"
            disabled={locked}
            value={find}
            onChange={(e) => setFind(e.target.value)}
          />
        </Field>
      </div>
      <ErrorBox error={error} />
      <ErrorBox
        key={review ? "review" : "input"}
        error={write.error}
        verbatim
      />
      {notice && <p role="status">{notice}</p>}
      {write.notice && <p role="status">{write.notice}</p>}
      {write.busy && (
        <p role="status">
          {t("Confirming on the server…", "سرور پر تصدیق جاری…")}
        </p>
      )}
      {write.attempt && !write.busy && (
        <section role="alert" className="notice">
          <p>
            {t(
              "The result is unknown. Keep this exact request; do not create another cleaning confirmation. A bed list alone cannot prove the original outcome.",
              "نتیجہ نامعلوم۔ یہی درخواست رکھیں؛ صفائی کی دوسری تصدیق نہ بنائیں۔ صرف بستر فہرست اصل نتیجہ ثابت نہیں کرتی۔",
            )}
          </p>
          <code>{write.attempt.key}</code>
          {canRetryWrite(write.attempt) && (
            <button data-help="mybeds.recovery" onClick={write.retry}>
              {t("Retry original request", "اصل درخواست دوبارہ بھیجیں")}
            </button>
          )}
          <button
            data-help="mybeds.recovery"
            onClick={() => void write.inspect()}
          >
            {t("Read current beds", "موجودہ بستر پڑھیں")}
          </button>
          {write.checked && <Details value={write.observed} />}
          <p>
            {t(
              "Retry uses the original key and body within 24 hours. Outside retention ask IT; navigation stays locked.",
              "دوبارہ ارسال اصل کلید و معلومات سے 24گھنٹے میں۔ مدت گزرے تو آئی ٹی؛ جگہ بدلنا مقفل ہے۔",
            )}
          </p>
        </section>
      )}
      <LoadState {...rows} retry={rows.reload} />
      <LoadState {...flow} retry={flow.reload} />
      {!rows.loading && !rows.error && rows.data?.length === 0 && (
        <Empty>
          {t(
            "No beds on your current ward duties. Ask the head nurse to check the duty and its bed assignments; a night duty stays until it ends.",
            "موجودہ وارڈ ڈیوٹی پر بستر نہیں۔ ہیڈ نرس سے ڈیوٹی و مقرر بستر چیک کرائیں؛ رات کی ڈیوٹی اختتام تک رہتی ہے۔",
          )}
        </Empty>
      )}
      <div className="split">
        <aside className="card">
          {urgentBeds(rows.data || [], overdue)
            .filter((b) =>
              [
                b.ward_name,
                b.bed_label,
                b.patient_name,
                b.mrn,
                b.shift_name,
                b.zone_label,
              ]
                .join(" ")
                .toLowerCase()
                .includes(find.toLowerCase()),
            )
            .map((b) => (
              <button
                data-help="mybeds.context"
                key={myBedKey(b)}
                className="list-row"
                disabled={locked || rows.loading || !!rows.error}
                onClick={() => choose(b)}
                aria-pressed={key === myBedKey(b)}
              >
                <strong>
                  {b.ward_name} · {b.bed_label} · {b.current_state}
                </strong>
                <span>
                  {b.patient_name ||
                    t("No current patient", "موجودہ مریض نہیں")}{" "}
                  · <bdi>{b.mrn}</bdi>
                </span>
                <span>
                  {b.shift_name} · {b.start_time}–{b.end_time} · {b.zone_label}
                </span>
                <span>
                  {b.doses_due_next_hour}{" "}
                  {t("doses due next hour", "خوراکیں اگلے گھنٹے میں")} ·{" "}
                  {b.admission_id &&
                  flow.data?.[b.admission_id]?.data?.is_overdue
                    ? t("Vitals overdue", "پیمائش میں تاخیر")
                    : t("Check vitals schedule", "پیمائش کا وقت دیکھیں")}
                </span>
              </button>
            ))}
          {!!rows.data?.length &&
            !urgentBeds(rows.data, overdue).some((b) =>
              [
                b.ward_name,
                b.bed_label,
                b.patient_name,
                b.mrn,
                b.shift_name,
                b.zone_label,
              ]
                .join(" ")
                .toLowerCase()
                .includes(find.toLowerCase()),
            ) && (
              <p>
                {t("No beds match this search.", "اس تلاش پر کوئی بستر نہیں۔")}
              </p>
            )}
        </aside>
        <article className="card">
          {!key && (
            <p>
              {t(
                "Choose your returned bed to review its patient and actions.",
                "مریض و عمل دیکھنے کے لیے فہرست کا اپنا بستر چنیں۔",
              )}
            </p>
          )}
          {key && !bed && !rows.loading && (
            <p>
              {t(
                "This bed is no longer in your current duties. Draft input is kept; read the list before another action.",
                "یہ بستر موجودہ ڈیوٹی میں نہیں۔ مسودہ محفوظ؛ اگلے عمل سے پہلے فہرست پڑھیں۔",
              )}
            </p>
          )}
          {bed && (
            <>
              <h2>
                {bed.ward_name} · {bed.bed_label} · {bed.current_state}
              </h2>
              <p>
                {bed.shift_name} · {bed.start_time}–{bed.end_time} ·{" "}
                {bed.zone_label}
              </p>
              <p>
                {t("Last vitals", "آخری پیمائش")}: {stamp(bed.last_vitals_at)}
              </p>
              {bed.admission_id && (
                <>
                  <LoadState {...detail} retry={detail.reload} />
                  <LoadState {...patient} retry={patient.reload} />
                  <h3>
                    {bed.patient_name} · <bdi>{bed.mrn}</bdi>
                  </h3>
                  {admission && (
                    <p>
                      {admission.admission_number} · {admission.status} ·{" "}
                      {person?.dob ??
                        person?.age_years ??
                        admission.age_years ??
                        t("Age not recorded", "عمر درج نہیں")}{" "}
                      · {person?.gender || admission.gender}
                    </p>
                  )}
                  {person && (
                    <>
                      <p>
                        {t("Allergies / blood group", "الرجی / خون گروپ")}:{" "}
                        {person.allergies || t("Not recorded", "درج نہیں")} ·{" "}
                        {person.blood_group || t("Not recorded", "درج نہیں")}
                      </p>
                      <p>
                        {person.is_deceased
                          ? t(
                              "Deceased: no new orders; hand over to the doctor.",
                              "وفات: نئے احکامات نہیں؛ ڈاکٹر کو دیں۔",
                            )
                          : ""}{" "}
                        {person.temp_identifier
                          ? t("Temporary identity: ", "عارضی شناخت: ") +
                            person.temp_identifier
                          : ""}{" "}
                        {person.mlc_numbers?.length
                          ? "MEDICO-LEGAL: " + person.mlc_numbers.join(", ")
                          : ""}{" "}
                        {person.merged_into_id
                          ? t(
                              "Merged identity: open the master record with the authorised desk.",
                              "ضم شناخت: مجاز ڈیسک سے اصل ریکارڈ کھلوائیں۔",
                            )
                          : ""}
                      </p>
                      <details>
                        <summary data-help="mybeds.context">
                          {t(
                            "Outstanding dues and linked identity",
                            "بقایا و متعلقہ شناخت",
                          )}
                        </summary>
                        <Details value={person.outstanding} />
                        {person.merged_profiles.map((p) => (
                          <p key={p.patient_id}>{p.mrn}</p>
                        ))}
                      </details>
                    </>
                  )}
                  {flow.data?.[bed.admission_id]?.error && (
                    <ErrorBox error={flow.data[bed.admission_id].error} />
                  )}
                  <p>
                    {t("Next vitals due", "اگلی پیمائش")}:{" "}
                    {stamp(
                      flow.data?.[bed.admission_id]?.data?.next_vitals_due_at,
                    )}{" "}
                    ·{" "}
                    {flow.data?.[bed.admission_id]?.data?.is_overdue
                      ? t("Overdue", "تاخیر")
                      : t(
                          "Use the recorded schedule; no local alert threshold.",
                          "اصل مقررہ وقت دیکھیں؛ مقامی حد نہیں۔",
                        )}
                  </p>
                  {canPaper && (
                    <div className="actions">
                      <button
                        data-help="mybeds.summary"
                        disabled={locked || !live}
                        onClick={() => void paper("read")}
                      >
                        {t(
                          "Read signed discharge summary",
                          "دستخط شدہ ڈسچارج خلاصہ پڑھیں",
                        )}
                      </button>
                      <button
                        data-help="mybeds.summary"
                        disabled={locked || !live}
                        onClick={() => void paper("print")}
                      >
                        {t(
                          "Print signed summary (A4)",
                          "دستخط شدہ خلاصہ پرنٹ (اے فور)",
                        )}
                      </button>
                      <button
                        data-help="mybeds.summary"
                        disabled={locked || !live}
                        onClick={() => void paper("pdf")}
                      >
                        {t(
                          "Save signed summary PDF",
                          "دستخط شدہ خلاصہ پی ڈی ایف محفوظ",
                        )}
                      </button>
                    </div>
                  )}
                  {summary &&
                    summary.fields.admission.admission_id ===
                      bed.admission_id && (
                      <section>
                        <h3>{summary.fields.title}</h3>
                        <p>
                          {summary.fields.admission.patient_name} ·{" "}
                          <bdi>{summary.fields.admission.mrn}</bdi>
                        </p>
                        <p>
                          {t("Medicines / follow-up", "دوائیں / دوبارہ معائنہ")}
                          :{" "}
                          {summary.fields.summary.discharge_medications ||
                            t("Not recorded", "درج نہیں")}{" "}
                          ·{" "}
                          {summary.fields.summary.follow_up_instructions ||
                            t("Not recorded", "درج نہیں")}
                        </p>
                        <p>{summary.fields.summary.follow_up_date}</p>
                        {summary.fields.corrections.map((c) => (
                          <p key={c.correction_id}>
                            <strong>
                              {t("Correction", "تصحیح")}: {c.field}
                            </strong>{" "}
                            · {c.correction_text} · {c.correction_reason} ·{" "}
                            {c.corrected_by_name} · {stamp(c.created_at)}
                          </p>
                        ))}
                        <p>
                          {summary.fields.summary.signer_name} ·{" "}
                          {summary.fields.summary.signer_license} ·{" "}
                          {stamp(summary.fields.summary.signed_at)}
                        </p>
                        <p>
                          {t(
                            "Explain these signed instructions to the patient/family. Printing does not certify that the explanation took place or release the bed.",
                            "دستخط شدہ ہدایات مریض یا اہل خانہ کو سمجھائیں۔ پرنٹ گفتگو کی تصدیق یا بستر خالی نہیں کرتا۔",
                          )}
                        </p>
                      </section>
                    )}
                </>
              )}
              {canCleanMyBed(bed, view, permissions) && (
                <button
                  data-help="mybeds.clean"
                  disabled={locked || !live}
                  onClick={begin}
                >
                  {t("Bed cleaned", "بستر صاف ہو گیا")}
                </button>
              )}
            </>
          )}
        </article>
      </div>
      <section className="card">
        <h2>{t("My duties", "میری ڈیوٹیاں")}</h2>
        <p>
          {t(
            "Dates and shifts come from your roster. Last night remains until its shift ends; no midnight filter is applied here.",
            "تاریخ و شفٹ اصل ڈیوٹی سے۔ رات کی ڈیوٹی اختتام تک؛ یہاں آدھی رات کا فلٹر نہیں۔",
          )}
        </p>
        <LoadState {...duties} retry={duties.reload} />
        {!duties.loading && !duties.error && duties.data?.length === 0 && (
          <p>
            {t(
              "No duties returned. Ask the head nurse to check your roster.",
              "کوئی ڈیوٹی نہیں۔ ہیڈ نرس سے فہرست چیک کرائیں۔",
            )}
          </p>
        )}
        {duties.data?.map((d) => (
          <p key={d.roster_id}>
            {d.roster_date} · {d.shift_name} · {d.start_time}–{d.end_time} ·{" "}
            {d.ward_name || d.department_name || d.duty_area} · {d.zone_label} ·{" "}
            {d.status}
            {d.is_on_call ? " · " + t("On call", "آن کال") : ""}
          </p>
        ))}
      </section>
      {draft && (
        <fieldset disabled={locked}>
          <legend>{t("Confirm bed cleaning", "بستر کی صفائی کی تصدیق")}</legend>
          <p>
            {draft.bed.ward_name} · {draft.bed.bed_label} ·{" "}
            {draft.bed.current_state} · {draft.bed.patient_name} ·{" "}
            <bdi>{draft.bed.mrn}</bdi>
          </p>
          <p>
            {t(
              "Only confirm actual completed cleaning where no badge station recorded it. Never use this button to bypass discharge clearance or claim a cleaner used the app.",
              "جہاں بیج اسٹیشن نے درج نہ کیا ہو صرف حقیقی مکمل صفائی کی تصدیق کریں۔ ڈسچارج کلیئرنس سے بچنے یا صفائی والے کے ایپ استعمال کا دعویٰ نہ کریں۔",
            )}
          </p>
          {stale && (
            <p role="status">
              {t(
                "Duty or bed data changed. Read current beds; input is kept.",
                "ڈیوٹی یا بستر بدلا۔ موجودہ بستر پڑھیں؛ معلومات محفوظ۔",
              )}
            </p>
          )}
          <Field
            label={t(
              "Find cleaner (optional)",
              "صفائی کرنے والا تلاش کریں (اختیاری)",
            )}
          >
            <input
              data-help="mybeds.cleaner"
              data-field="cleaned_by_employee_id"
              value={staffQ}
              minLength={2}
              maxLength={80}
              onChange={(e) => {
                setStaffQ(e.target.value);
                setDraft({ ...draft, cleaner: undefined });
                setReview(undefined);
              }}
            />
          </Field>
          <button
            data-help="mybeds.cleaner"
            disabled={staffQ.trim().length < 2}
            onClick={() => setSearchQ(staffQ.trim())}
          >
            {t("Find staff", "عملہ تلاش کریں")}
          </button>
          <LoadState {...staff} retry={staff.reload} />
          {staff.data?.map((s) => (
            <button
              data-help="mybeds.cleaner"
              key={s.employee_id}
              onClick={() => {
                setDraft({ ...draft, cleaner: s });
                setReview(undefined);
              }}
            >
              {s.full_name} · {s.emp_number} · {s.designation} ·{" "}
              {s.department_name}
            </button>
          ))}
          {draft.cleaner && (
            <p>
              {t("Selected cleaner", "منتخب صفائی والا")}:{" "}
              {draft.cleaner.full_name} · {draft.cleaner.emp_number}
              <button
                data-help="mybeds.cleaner"
                onClick={() => {
                  setDraft({ ...draft, cleaner: undefined });
                  setReview(undefined);
                }}
              >
                {t("Clear optional cleaner", "اختیاری صفائی والا ہٹائیں")}
              </button>
            </p>
          )}
          <label>
            <input
              data-help="mybeds.clean"
              type="checkbox"
              checked={draft.ack}
              onChange={(e) => {
                setDraft({ ...draft, ack: e.target.checked });
                setReview(undefined);
              }}
            />
            {t(
              "I verified this bed and that cleaning was completed",
              "میں نے بستر و مکمل صفائی کی تصدیق کی",
            )}
          </label>
          <div className="actions">
            <button
              data-help="mybeds.review"
              disabled={!draft.ack || stale || !live}
              onClick={() =>
                setReview(
                  draft.cleaner
                    ? { cleaned_by_employee_id: draft.cleaner.employee_id }
                    : {},
                )
              }
            >
              {t("Review cleaning confirmation", "صفائی کی تصدیق کا جائزہ")}
            </button>
            <button
              data-help="mybeds.recovery"
              onClick={async () => {
                try {
                  const fresh = await a.myBeds(),
                    b = fresh.find((b) => myBedKey(b) === myBedKey(draft.bed));
                  if (!b)
                    throw Error(
                      t(
                        "The bed left this duty. Close this draft after checking with the head nurse.",
                        "بستر اس ڈیوٹی میں نہیں۔ ہیڈ نرس سے چیک کر کے مسودہ بند کریں۔",
                      ),
                    );
                  setDraft({ ...draft, bed: b, ack: false });
                  setReview(undefined);
                  setStale(false);
                  setTick((n) => n + 1);
                } catch (e) {
                  setError(e);
                }
              }}
            >
              {t(
                "Read current beds and keep input",
                "موجودہ بستر پڑھیں و معلومات رکھیں",
              )}
            </button>
            <button
              data-help="mybeds.review"
              onClick={() => {
                if (leave()) {
                  setDraft(undefined);
                  setReview(undefined);
                }
              }}
            >
              {t("Close cleaning draft", "صفائی کا مسودہ بند")}
            </button>
          </div>
        </fieldset>
      )}
      {review && draft && (
        <Modal
          title={t("Review cleaning confirmation", "صفائی کی تصدیق کا جائزہ")}
          closable={!write.blocked}
          onClose={() => setReview(undefined)}
        >
          <p>
            {draft.bed.ward_name} · {draft.bed.bed_label} ·{" "}
            {draft.bed.patient_name} · <bdi>{draft.bed.mrn}</bdi> ·{" "}
            {draft.bed.shift_name}
          </p>
          <p>
            {draft.cleaner?.full_name ||
              t(
                "No cleaner named; your confirmation is attributed to you.",
                "صفائی والا نام نہیں؛ تصدیق آپ سے منسوب ہوگی۔",
              )}
          </p>
          <Details value={review} />
          <div className="actions">
            <button
              data-help="mybeds.review"
              disabled={locked || stale || !live}
              onClick={confirm}
            >
              {t("Confirm this cleaning once", "یہ صفائی ایک بار تصدیق کریں")}
            </button>
            <button
              data-help="mybeds.review"
              disabled={locked}
              onClick={() => setReview(undefined)}
            >
              {t("Back to cleaning input", "صفائی کی معلومات پر واپس")}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
