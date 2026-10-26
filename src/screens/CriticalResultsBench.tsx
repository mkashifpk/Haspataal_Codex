import { useEffect, useRef, useState } from "react";
import { api, call } from "../bridge";
import {
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  useLoad,
} from "../components";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import { bilingual as t } from "../i18n";
import { formatHospitalTime } from "../hospital-time";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";
import * as critical from "../generated/critical_results_bench";
import {
  benchCriticalWork,
  communicationBody,
  communicationMeans,
  criticalAccess,
  criticalFilters,
  criticalSnapshot,
  recipientRoles,
  requiresReadBack,
} from "../critical-communication-policy";

const words: Record<string, [string, string]> = {
  Open: [
    "Open — tell the responsible clinician now",
    "کھلا — ذمہ دار معالج کو ابھی بتائیں",
  ],
  Communicated: [
    "Communicated — awaiting doctor acknowledgement",
    "اطلاع دی — معالج کی تسلیم کا انتظار",
  ],
  Acknowledged: ["Acknowledged by doctor", "معالج نے تسلیم کیا"],
  Telephone: ["Telephone", "ٹیلی فون"],
  InPerson: ["In person", "روبرو"],
  Written: ["Written", "تحریری"],
  Electronic: ["Electronic", "برقی"],
  RequestingDoctor: ["Requesting doctor", "ٹیسٹ مانگنے والا معالج"],
  TreatingDoctor: ["Treating doctor", "علاج کرنے والا معالج"],
  OnCallDoctor: ["On-call doctor", "ڈیوٹی معالج"],
  WardNurse: ["Ward nurse", "وارڈ نرس"],
  Patient: ["Patient", "مریض"],
  Attendant: ["Attendant", "تیماردار"],
  HealthAuthority: ["Health authority", "صحت کا متعلقہ ادارہ"],
  CriticalToCommunicate: [
    "Critical result to communicate",
    "فوری نتیجہ بتانا ہے",
  ],
  PriorityDiseaseToNotify: [
    "Priority disease: notify health authority",
    "ترجیحی بیماری: ادارۂ صحت کو اطلاع",
  ],
};
const label = (key: string) => (words[key] ? t(...words[key]) : key);
type Review = {
  record: critical.CriticalResultDetailOut;
  body: critical.CommunicationIn;
};
export function CriticalResultsBench({
  user,
  connected,
  stream,
  establishment,
  timeZone,
}: {
  user: ClinicalUser;
  connected: boolean;
  stream: string;
  establishment: EstablishmentOut;
  timeZone?: string;
}) {
  const view =
    establishment.views.screens.find(
      (s) => s.screen_id === "critical_results_bench",
    )?.view || "hidden";
  const access = criticalAccess(user.permissions, view),
    live = connected && stream === "Live";
  const [revision, setRevision] = useState(0),
    [detailRevision, setDetailRevision] = useState(0);
  const [onlyOpen, setOnlyOpen] = useState(true),
    [status, setStatus] = useState(""),
    [mine, setMine] = useState(false),
    [limit, setLimit] = useState("200"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [find, setFind] = useState("");
  const [filters, setFilters] = useState<
    Parameters<typeof critical.listCritical>[0]
  >({ source: "Lab", open_only: true, limit: 200 });
  const [id, setId] = useState(0),
    [lookup, setLookup] = useState(""),
    [error, setError] = useState<unknown>();
  const [means, setMeans] = useState("Telephone"),
    [role, setRole] = useState("RequestingDoctor"),
    [name, setName] = useState(""),
    [note, setNote] = useState(""),
    [readBack, setReadBack] = useState(false),
    [told, setTold] = useState(false);
  const [review, setReview] = useState<Review>(),
    [alarm, setAlarm] = useState<number>(),
    [alarmError, setAlarmError] = useState<unknown>(),
    [notice, setNotice] = useState(false);
  const dirty = !!name || !!note || readBack || told;
  const currentId = useRef(id);
  currentId.current = id;
  const list = useLoad(
    () =>
      access.read
        ? critical.listCritical({
            ...filters,
            source: "Lab",
            ...(view === "records"
              ? { open_only: false, status: undefined }
              : {}),
          })
        : Promise.resolve([]),
    [access.read, view, filters, revision],
  );
  const work = useLoad(
    () =>
      access.work
        ? critical.diagnosticsWorklist({ area: "Lab", mine: false })
        : Promise.resolve([]),
    [access.work, revision],
  );
  const detail = useLoad(
    () =>
      access.read && id ? critical.getCritical(id) : Promise.resolve(undefined),
    [access.read, id, detailRevision, view],
  );
  const record =
    !detail.loading &&
    !detail.error &&
    detail.data?.critical_result_id === id &&
    detail.data.source === "Lab"
      ? detail.data
      : undefined;
  const rows =
    !list.loading && !list.error
      ? (list.data || []).filter(
          (r) =>
            r.source === "Lab" &&
            `${r.critical_number} ${r.patient_name} ${r.mrn} ${r.test_name} ${r.finding}`
              .toLowerCase()
              .includes(find.trim().toLowerCase()),
        )
      : [];
  const tasks =
    !work.loading && !work.error ? benchCriticalWork(work.data || []) : [];
  const write = useClinicalWrite(
    user,
    `critical-bench:${id}`,
    async (result) => {
      const saved = result as critical.CriticalResultDetailOut;
      setReview(undefined);
      setName("");
      setNote("");
      setReadBack(false);
      setTold(false);
      setNotice(true);
      setRevision((n) => n + 1);
      if (saved.critical_result_id === currentId.current)
        setDetailRevision((n) => n + 1);
    },
  );
  const blocked = write.blocked;
  const time = (value: string | null | undefined) =>
    value
      ? timeZone
        ? formatHospitalTime(value, timeZone)
        : value
      : t("Not recorded", "درج نہیں");
  async function sound(resultId: number) {
    setAlarmError(undefined);
    try {
      await call("critical-result-alarm", { criticalResultId: resultId });
    } catch (e) {
      setAlarmError(e);
    }
  }
  useEffect(
    () =>
      window.terminal.subscribe((e) => {
        if (e.type === "event" && e.event_type === "critical_result.updated") {
          setRevision((n) => n + 1);
          if (e.payload?.critical_result_id === currentId.current)
            setDetailRevision((n) => n + 1);
          if (e.payload?.status !== "Open")
            setAlarm((current) =>
              current === e.payload?.critical_result_id ? undefined : current,
            );
          if (
            access.work &&
            e.payload?.source === "Lab" &&
            e.payload?.change === "Opened" &&
            Number.isSafeInteger(e.payload?.critical_result_id)
          ) {
            setAlarm(e.payload.critical_result_id);
            void sound(e.payload.critical_result_id);
          }
        }
        if (e.type === "stream" && e.status === "Live" && e.resync) {
          setRevision((n) => n + 1);
          setDetailRevision((n) => n + 1);
        }
      }),
    [access.work],
  );
  useEffect(() => {
    if (!dirty && !blocked) return;
    const stop = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", stop);
    return () => window.removeEventListener("beforeunload", stop);
  }, [dirty, blocked]);
  function open(resultId: number) {
    if (blocked || review) return;
    if (!Number.isSafeInteger(resultId) || resultId < 1) {
      setError(
        Error(
          t(
            "Enter a valid known critical result ID.",
            "اہم نتیجے کا درست معلوم نمبر درج کریں۔",
          ),
        ),
      );
      return;
    }
    if (
      resultId !== id &&
      dirty &&
      !window.confirm(
        t(
          "Discard this unsent communication draft and change result?",
          "غیر ارسال اطلاع کا مسودہ چھوڑ کر نتیجہ بدلیں؟",
        ),
      )
    )
      return;
    if (resultId !== id) {
      setName("");
      setNote("");
      setReadBack(false);
      setTold(false);
      setNotice(false);
    }
    setError(undefined);
    setId(resultId);
    setLookup(String(resultId));
    setDetailRevision((n) => n + 1);
  }
  function prepare() {
    if (!record || blocked || !access.communicate || !live) return;
    setError(undefined);
    try {
      setReview({
        record,
        body: communicationBody(means, role, name, readBack, note, told),
      });
    } catch (e) {
      setError(e);
    }
  }
  function confirm() {
    if (!review || blocked || !live) return;
    const frozen = review;
    write.start(
      {
        method: "POST",
        path: `/critical-results/${frozen.record.critical_result_id}/communications`,
        body: frozen.body,
        permission: "diagnostics.critical.communicate",
        protection: "idempotent",
        reconcilePath: `/critical-results/${frozen.record.critical_result_id}`,
        label: t(
          "Record completed critical-result communication",
          "اہم نتیجے کی مکمل اطلاع درج کریں",
        ),
      },
      async () => {
        const [me, est, fresh] = await Promise.all([
          api<ClinicalUser>("GET", "/auth/me"),
          api<EstablishmentOut>("GET", "/establishment"),
          critical.getCritical(frozen.record.critical_result_id),
        ]);
        if (
          me.user_id !== user.user_id ||
          !live ||
          !criticalAccess(
            me.permissions,
            est.views.screens.find(
              (s) => s.screen_id === "critical_results_bench",
            )?.view || "hidden",
          ).communicate ||
          fresh.source !== "Lab" ||
          criticalSnapshot(fresh) !== criticalSnapshot(frozen.record)
        )
          throw Error(
            t(
              "The result, communication history, permission or service changed. Close and review the current record again.",
              "نتیجہ، اطلاع کی تاریخ، اجازت یا خدمت بدل گئی۔ بند کرکے تازہ ریکارڈ کا پھر جائزہ لیں۔",
            ),
          );
        communicationBody(
          frozen.body.means,
          frozen.body.recipient_role,
          frozen.body.recipient_name,
          !!frozen.body.read_back,
          frozen.body.note || "",
          true,
        );
      },
    );
  }
  if (!access.read)
    return (
      <Empty>
        {t(
          "This laboratory screen is unavailable or you lack critical-result viewing permission.",
          "یہ لیب صفحہ دستیاب نہیں یا اہم نتائج پڑھنے کی اجازت نہیں۔",
        )}
      </Empty>
    );
  return (
    <section
      className="critical-bench-screen"
      data-help-screen="critical_results_bench"
      data-write-pending={blocked}
      data-unsaved={dirty && !blocked}
    >
      <header className="section-heading">
        <div>
          <h1>{t("Critical results to tell", "فوری بتانے والے اہم نتائج")}</h1>
          <p>
            {t(
              "Tell the responsible clinician now. Record each completed communication and track acknowledgement.",
              "ذمہ دار معالج کو فوراً بتائیں۔ ہر مکمل اطلاع درج اور تسلیم کی حالت دیکھیں۔",
            )}
          </p>
        </div>
        <button
          data-help="critical.refresh"
          disabled={blocked || !!review}
          onClick={() => {
            setRevision((n) => n + 1);
            setDetailRevision((n) => n + 1);
          }}
        >
          {t("Refresh critical results", "اہم نتائج تازہ کریں")}
        </button>
      </header>
      <p role="status">
        {connected ? stream : t("Offline", "آف لائن")} ·{" "}
        {t("Laboratory", "لیبارٹری")}
        {view === "open_work"
          ? " · " +
            t(
              "No new laboratory work; complete existing communications.",
              "نیا لیب کام نہیں؛ موجودہ اطلاعات مکمل کریں۔",
            )
          : view === "records"
            ? " · " +
              t(
                "Records only — no new communication",
                "صرف ریکارڈ — نئی اطلاع درج نہیں",
              )
            : ""}
      </p>
      {!live && (
        <p className="notice">
          {t(
            "Restore the live connection before recording; tell the clinician by the hospital’s urgent communication procedure now.",
            "درج کرنے سے پہلے لائیو رابطہ بحال کریں؛ ابھی ہسپتال کے فوری طریقے سے معالج کو بتائیں۔",
          )}
        </p>
      )}
      {alarm && (
        <aside className="bench-critical" role="alert">
          <strong>
            {t(
              "A new critical laboratory result opened. Tell the responsible clinician now and record the communication.",
              "نیا اہم لیب نتیجہ آیا۔ ذمہ دار معالج کو فوراً بتا کر اطلاع درج کریں۔",
            )}
          </strong>
          <button
            data-help="critical.alarm"
            onClick={() => setAlarm(undefined)}
          >
            {t("Dismiss this reminder only", "صرف یہ یاددہانی چھپائیں")}
          </button>
        </aside>
      )}
      {!!alarmError && (
        <>
          <p className="bench-critical">
            {t(
              "Alarm could not play. Attend to the critical result now.",
              "الارم نہیں بج سکا۔ اہم نتیجے پر ابھی توجہ دیں۔",
            )}
          </p>
          <ErrorBox error={alarmError} />
        </>
      )}
      <ErrorBox error={error} />
      {notice && (
        <p role="status">
          {t(
            "Communication recorded on the server. Doctor acknowledgement and health-authority notification are separate obligations.",
            "اطلاع سرور پر درج۔ معالج کی تسلیم اور ادارۂ صحت کی اطلاع الگ ذمہ داریاں ہیں۔",
          )}
        </p>
      )}
      {!review && (
        <ClinicalWriteFeedback
          write={{ ...write, notice: "" }}
          onReviewed={() => {
            setRevision((n) => n + 1);
            setDetailRevision((n) => n + 1);
          }}
        />
      )}
      <fieldset
        className="critical-bench-layout"
        disabled={blocked || !!review}
      >
        {access.work && (
          <section className="card critical-work">
            <h2>{t("Urgent communication worklist", "فوری اطلاع کی فہرست")}</h2>
            <LoadState {...work} retry={work.reload} />
            {!work.loading && !work.error && !tasks.length && (
              <p role="status">
                {t(
                  "No critical communication or priority-disease notification is pending in this worklist.",
                  "فہرست میں اہم اطلاع یا ترجیحی بیماری کی اطلاع باقی نہیں۔",
                )}
              </p>
            )}
            {tasks.map((task, i) => (
              <article
                key={`${task.kind}:${task.critical_result_id}:${i}`}
                className={task.is_overdue ? "bench-critical" : "card"}
                data-testid="critical-work-row"
              >
                <strong>{label(task.kind)}</strong>
                <p>
                  <bdi>
                    {task.patient_name} · {task.mrn} · {task.title}
                  </bdi>
                </p>
                <p>{task.detail}</p>
                <p>
                  {task.is_overdue && t("OVERDUE · ", "تاخیر · ")}
                  {t("Server due time", "سرور مقرر وقت")}:{" "}
                  <bdi>{time(task.due_at)}</bdi>
                </p>
                {task.critical_result_id ? (
                  <button
                    data-help="critical.open"
                    onClick={() => open(task.critical_result_id!)}
                  >
                    {t("Open worklist result", "فہرست کا نتیجہ کھولیں")} #
                    {task.critical_result_id}
                  </button>
                ) : (
                  <p>
                    {t(
                      "The server supplied no related critical-result ID. Ask laboratory support; do not guess one.",
                      "سرور نے متعلقہ اہم نتیجے کا نمبر نہیں دیا۔ لیب معاونت سے کہیں؛ نمبر فرض نہ کریں۔",
                    )}
                  </p>
                )}
              </article>
            ))}
          </section>
        )}
        <section className="card critical-log">
          <h2>{t("Critical laboratory log", "اہم لیب نتائج کا رجسٹر")}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(undefined);
              try {
                setFilters({
                  source: "Lab",
                  open_only: onlyOpen,
                  status:
                    (status as "Open" | "Communicated" | "Acknowledged") ||
                    undefined,
                  mine,
                  ...criticalFilters(limit, from, to),
                });
              } catch (e) {
                setError(e);
              }
            }}
          >
            <div className="form-grid">
              <Field label={t("Result status", "نتیجے کی حالت")}>
                <select
                  data-help="critical.filters"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={view === "records"}
                >
                  <option value="">{t("All statuses", "تمام حالتیں")}</option>
                  {["Open", "Communicated", "Acknowledged"].map((x) => (
                    <option key={x} value={x}>
                      {label(x)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("From date", "ابتدائی تاریخ")}>
                <input
                  data-help="critical.filters"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </Field>
              <Field label={t("To date", "آخری تاریخ")}>
                <input
                  data-help="critical.filters"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
              <Field
                label={t(
                  "Maximum results (1–1000)",
                  "زیادہ سے زیادہ نتائج (1–1000)",
                )}
              >
                <input
                  data-help="critical.filters"
                  inputMode="numeric"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                />
              </Field>
            </div>
            <label>
              <input
                data-help="critical.filters"
                type="checkbox"
                checked={onlyOpen}
                disabled={view === "records"}
                onChange={(e) => setOnlyOpen(e.target.checked)}
              />
              {t("Not yet acknowledged only", "صرف معالج کی تسلیم کے منتظر")}
            </label>
            <label>
              <input
                data-help="critical.filters"
                type="checkbox"
                checked={mine}
                onChange={(e) => setMine(e.target.checked)}
              />
              {t(
                "My patients only (requesting doctor or consultant)",
                "صرف میرے مریض (ٹیسٹ مانگنے والا معالج یا کنسلٹنٹ)",
              )}
            </label>
            <button data-help="critical.filters">
              {t("Apply log filters", "رجسٹر کی چھانٹی لگائیں")}
            </button>
          </form>
          <Field
            label={t(
              "Find in returned critical results",
              "موصولہ اہم نتائج میں تلاش",
            )}
          >
            <input
              data-help="critical.find"
              value={find}
              onChange={(e) => setFind(e.target.value)}
            />
          </Field>
          <LoadState {...list} retry={list.reload} />
          {!list.loading &&
            !list.error &&
            list.data?.length === filters?.limit && (
              <p className="notice">
                {t(
                  "Result limit reached. Narrow the dates or status; this endpoint has no next-page cursor.",
                  "نتائج کی حد پوری۔ تاریخ یا حالت محدود کریں؛ اگلے صفحے کا کرسر نہیں۔",
                )}
              </p>
            )}
          {!list.loading && !list.error && !rows.length && (
            <Empty>
              {t(
                "No results match these filters. Clear local search or adjust dates/status; acknowledged records require turning off the open-only filter.",
                "ان چھانٹیوں میں نتیجہ نہیں۔ تلاش صاف یا تاریخ و حالت بدلیں؛ تسلیم شدہ کے لیے صرف کھلے کی شرط ہٹائیں۔",
              )}
            </Empty>
          )}
          {rows.map((r) => (
            <article
              className={r.is_overdue ? "bench-critical" : "card"}
              key={r.critical_result_id}
              data-testid="critical-log-row"
            >
              <strong>
                <bdi>
                  {r.critical_number} · {r.patient_name} · {r.mrn}
                </bdi>
              </strong>
              <p>
                {label(r.status)}{" "}
                {r.is_overdue && <strong> · {t("OVERDUE", "تاخیر")}</strong>}
              </p>
              <p>
                <bdi>
                  {r.test_name}: {r.finding}
                </bdi>
              </p>
              <p>
                {t("Tell by", "اطلاع کا مقرر وقت")}:{" "}
                <bdi>{time(r.communicate_due_at)}</bdi> ·{" "}
                {t("Escalation level", "اطلاع کی اگلی سطح")}:{" "}
                {r.escalation_level}
              </p>
              {r.authority_pending && (
                <p className="notice">
                  {t(
                    "Health authority notification still required",
                    "ادارۂ صحت کو اطلاع ابھی لازم",
                  )}
                  : <bdi>{r.notifiable_disease}</bdi>
                </p>
              )}
              <button
                data-help="critical.open"
                onClick={() => open(r.critical_result_id)}
                aria-pressed={id === r.critical_result_id}
              >
                {t("Open critical result", "اہم نتیجہ کھولیں")}{" "}
                <bdi>{r.critical_number}</bdi>
              </button>
            </article>
          ))}
        </section>
        <section className="card critical-current">
          <form
            className="actions"
            onSubmit={(e) => {
              e.preventDefault();
              open(Number(lookup));
            }}
          >
            <Field
              label={t("Known critical result ID", "اہم نتیجے کا معلوم نمبر")}
            >
              <input
                data-help="critical.open"
                inputMode="numeric"
                value={lookup}
                onChange={(e) => setLookup(e.target.value)}
              />
            </Field>
            <button data-help="critical.open">
              {t("Read known critical result", "معلوم اہم نتیجہ پڑھیں")}
            </button>
          </form>
          {id > 0 && <LoadState {...detail} retry={detail.reload} />}{" "}
          {!detail.loading &&
            !detail.error &&
            detail.data &&
            detail.data.source !== "Lab" && (
              <p className="error" role="alert">
                {t(
                  "This is not a laboratory result. Use the authorised imaging workflow.",
                  "یہ لیب نتیجہ نہیں۔ مجاز عکس کا طریقۂ کار استعمال کریں۔",
                )}
              </p>
            )}
          {record && (
            <>
              <div
                data-testid="critical-detail"
                className={record.is_overdue ? "bench-critical" : "notice"}
              >
                <h2>
                  <bdi>
                    {record.critical_number} · {record.patient_name} ·{" "}
                    {record.mrn}
                  </bdi>
                </h2>
                <p>
                  <strong>{label(record.status)}</strong>{" "}
                  {record.is_overdue && t(" · OVERDUE", " · تاخیر")}
                </p>
                <p>
                  <bdi>
                    {record.test_name}: {record.finding}
                  </bdi>
                </p>
                <p>
                  {t(
                    "Responsible requesting doctor",
                    "ٹیسٹ مانگنے والا ذمہ دار معالج",
                  )}
                  :{" "}
                  <bdi>
                    {record.requester_doctor_name ||
                      t(
                        "Not supplied — follow the on-call escalation procedure",
                        "نام نہیں ملا — ڈیوٹی معالج کے فوری طریقے پر عمل کریں",
                      )}
                  </bdi>
                </p>
                <p>
                  <bdi>
                    {record.admission_number} · {record.ward_name} ·{" "}
                    {record.bed_label}
                  </bdi>
                </p>
                <p>
                  {t("Released by", "جاری کرنے والا")}:{" "}
                  <bdi>
                    {record.reported_by_name} · {time(record.reported_at)}
                  </bdi>
                </p>
                <p>
                  {t("Communication due", "اطلاع کا مقرر وقت")}:{" "}
                  <bdi>{time(record.communicate_due_at)}</bdi>
                </p>
                <p>
                  {t(
                    "First responsible communication",
                    "ذمہ دار کو پہلی اطلاع",
                  )}
                  : <bdi>{time(record.communicated_at)}</bdi>
                </p>
                <p>
                  {t("Escalation level / time", "اگلی اطلاع کی سطح / وقت")}:{" "}
                  {record.escalation_level} ·{" "}
                  <bdi>{time(record.escalated_at)}</bdi>
                </p>
                {record.notifiable_disease && (
                  <p
                    className={
                      record.authority_pending ? "bench-abnormal" : "notice"
                    }
                  >
                    {t("Priority disease", "ترجیحی بیماری")}:{" "}
                    <bdi>{record.notifiable_disease}</bdi> ·{" "}
                    {record.authority_pending
                      ? t(
                          "Health authority not yet notified",
                          "ادارۂ صحت کو ابھی اطلاع نہیں",
                        )
                      : t(
                          "Health authority informed",
                          "ادارۂ صحت کو اطلاع دی",
                        )}{" "}
                    · <bdi>{time(record.authority_informed_at)}</bdi>
                  </p>
                )}
                <p>
                  {t("Doctor acknowledgement", "معالج کی تسلیم")}:{" "}
                  <bdi>
                    {record.acknowledged_by_name ||
                      t("Awaiting acknowledgement", "تسلیم کا انتظار")}{" "}
                    · {time(record.acknowledged_at)}
                  </bdi>
                </p>
                {record.action_taken && (
                  <p>
                    <bdi>{record.action_taken}</bdi>
                  </p>
                )}
                {access.work && record.status === "Open" && (
                  <button
                    data-help="critical.alarm"
                    onClick={() => void sound(record.critical_result_id)}
                  >
                    {t(
                      "Play alarm for this open result",
                      "اس کھلے نتیجے کا الارم بجائیں",
                    )}
                  </button>
                )}
              </div>
              <section data-testid="critical-history">
                <h3>{t("Communication history", "اطلاعات کی تاریخ")}</h3>
                {!record.communications.length && (
                  <p>
                    {t(
                      "No communication has been recorded. Tell the responsible clinician now.",
                      "ابھی کوئی اطلاع درج نہیں۔ ذمہ دار معالج کو فوراً بتائیں۔",
                    )}
                  </p>
                )}
                {record.communications.map((c) => (
                  <article className="card" key={c.communication_id}>
                    <strong>
                      {label(c.recipient_role)}: <bdi>{c.recipient_name}</bdi>
                    </strong>
                    <p>
                      {label(c.means)} · {t("Read back", "دہرا کر تصدیق")}:{" "}
                      {c.read_back ? t("Yes", "ہاں") : t("No", "نہیں")}
                    </p>
                    <p>
                      {t("Recorded by", "درج کرنے والا")}:{" "}
                      <bdi>
                        {c.informed_by_name} · {time(c.informed_at)}
                      </bdi>
                    </p>
                    <p>
                      <bdi>{c.note}</bdi>
                    </p>
                  </article>
                ))}
              </section>
              {access.communicate && (
                <section className="card" data-unsaved={dirty}>
                  <h3>
                    {t(
                      "Record a completed communication",
                      "مکمل کی گئی اطلاع درج کریں",
                    )}
                  </h3>
                  <p>
                    {t(
                      "Call or tell the actual person first. Saving this record does not place a call, notify an authority, or acknowledge the result as a doctor.",
                      "پہلے اصل شخص کو بتائیں۔ یہ ریکارڈ محفوظ کرنا کال، ادارے کو اطلاع یا معالج کی تسلیم نہیں کرتا۔",
                    )}
                  </p>
                  <fieldset disabled={!live}>
                    <div className="form-grid">
                      <Field label={t("Communication means", "اطلاع کا طریقہ")}>
                        <select
                          data-help="critical.communication"
                          value={means}
                          onChange={(e) => {
                            setMeans(e.target.value);
                            setReadBack(false);
                            setTold(false);
                          }}
                        >
                          {communicationMeans.map((x) => (
                            <option key={x} value={x}>
                              {label(x)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field
                        label={t("Recipient role", "اطلاع پانے والے کا کردار")}
                      >
                        <select
                          data-help="critical.recipient"
                          value={role}
                          onChange={(e) => {
                            setRole(e.target.value);
                            setReadBack(false);
                            setTold(false);
                          }}
                        >
                          {recipientRoles.map((x) => (
                            <option key={x} value={x}>
                              {label(x)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    {["HealthAuthority", "Patient", "Attendant"].includes(
                      role,
                    ) && (
                      <p className="notice">
                        {t(
                          "This recipient is separate from telling the responsible clinician. Check both obligations on the actual record.",
                          "اس وصول کنندہ کو اطلاع ذمہ دار معالج کی اطلاع سے الگ ہے۔ اصل ریکارڈ پر دونوں ذمہ داریاں چیک کریں۔",
                        )}
                      </p>
                    )}
                    <Field
                      label={t(
                        "Recipient name and designation",
                        "وصول کنندہ کا نام اور عہدہ",
                      )}
                    >
                      <input
                        data-help="critical.recipient"
                        value={name}
                        maxLength={200}
                        onChange={(e) => {
                          setName(e.target.value);
                          setReadBack(false);
                          setTold(false);
                        }}
                      />
                    </Field>
                    <Field
                      label={t(
                        "Communication note (optional)",
                        "اطلاع کا نوٹ (اختیاری)",
                      )}
                    >
                      <textarea
                        data-help="critical.communication"
                        value={note}
                        maxLength={1000}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </Field>
                    <label>
                      <input
                        data-help="critical.readback"
                        type="checkbox"
                        checked={readBack}
                        onChange={(e) => setReadBack(e.target.checked)}
                      />
                      {requiresReadBack(means)
                        ? t(
                            "The recipient read the result back (required)",
                            "وصول کنندہ نے نتیجہ دہرا کر تصدیق کی (لازم)",
                          )
                        : t(
                            "The recipient read the result back",
                            "وصول کنندہ نے نتیجہ دہرا کر تصدیق کی",
                          )}
                    </label>
                    <label>
                      <input
                        data-help="critical.communication"
                        type="checkbox"
                        checked={told}
                        onChange={(e) => setTold(e.target.checked)}
                      />
                      {t(
                        "I already told this recipient; this records the completed communication.",
                        "میں اس وصول کنندہ کو بتا چکا ہوں؛ یہ مکمل اطلاع کا ریکارڈ ہے۔",
                      )}
                    </label>
                    <button
                      className="primary"
                      data-help="critical.review"
                      onClick={prepare}
                    >
                      {t(
                        "Review communication record",
                        "اطلاع کے ریکارڈ کا جائزہ",
                      )}
                    </button>
                  </fieldset>
                </section>
              )}
              {!access.communicate && (
                <p>
                  {t(
                    "Communication recording requires its own permission and an active work view. History remains read-only.",
                    "اطلاع درج کرنے کو الگ اجازت اور کام کا منظر لازم؛ تاریخ صرف پڑھ سکتے ہیں۔",
                  )}
                </p>
              )}
            </>
          )}
        </section>
      </fieldset>
      {review && (
        <Modal
          title={t(
            "Confirm critical-result communication",
            "اہم نتیجے کی اطلاع کی تصدیق",
          )}
          closable={!blocked}
          onClose={() => !blocked && setReview(undefined)}
        >
          <p>
            <bdi>
              {review.record.critical_number} · {review.record.patient_name} ·{" "}
              {review.record.mrn} · {review.record.test_name}
            </bdi>
          </p>
          <p>
            <bdi>{review.record.finding}</bdi>
          </p>
          <p>
            {label(review.body.means)} · {label(review.body.recipient_role)} ·{" "}
            <bdi>{review.body.recipient_name}</bdi>
          </p>
          <p>
            {t("Read back", "دہرا کر تصدیق")}:{" "}
            {review.body.read_back ? t("Yes", "ہاں") : t("No", "نہیں")}
          </p>
          <p>
            <bdi>{review.body.note}</bdi>
          </p>
          <ClinicalWriteFeedback
            write={{ ...write, notice: "" }}
            onReviewed={() => {
              setReview(undefined);
              setDetailRevision((n) => n + 1);
              setRevision((n) => n + 1);
            }}
          />
          <button
            className="primary"
            data-help="critical.confirm"
            disabled={blocked || !live}
            onClick={confirm}
          >
            {t("Confirm completed communication", "مکمل اطلاع کی تصدیق کریں")}
          </button>
        </Modal>
      )}
    </section>
  );
}
