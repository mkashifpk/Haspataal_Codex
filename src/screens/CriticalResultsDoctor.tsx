import { useEffect, useRef, useState } from "react";
import { api, ApiError, call } from "../bridge";
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
import * as critical from "../generated/critical_results_doctor";
import { criticalFilters } from "../critical-communication-policy";
import {
  acknowledgementBody,
  acknowledgementSnapshot,
  criticalReport,
  doctorCriticalAccess,
  doctorCriticalWork,
} from "../critical-acknowledgement-policy";

const refreshAlerts = () =>
  window.dispatchEvent(new Event("doctor-critical-refresh"));
const communicationLabel = (s: string) =>
  (
    ({
      Telephone: t("Telephone", "ٹیلی فون"),
      InPerson: t("In person", "روبرو"),
      Written: t("Written", "تحریری"),
      Electronic: t("Electronic", "برقی"),
      RequestingDoctor: t("Requesting doctor", "مانگنے والا معالج"),
      TreatingDoctor: t("Treating doctor", "علاج کرنے والا معالج"),
      OnCallDoctor: t("On-call doctor", "ڈیوٹی معالج"),
      WardNurse: t("Ward nurse", "وارڈ نرس"),
      Patient: t("Patient", "مریض"),
      Attendant: t("Attendant", "تیماردار"),
      HealthAuthority: t("Health authority", "ادارۂ صحت"),
    }) as Record<string, string>
  )[s] || s;
const stateLabel = (s: string) =>
  s === "Open"
    ? t("Open — action needed", "کھلا — کارروائی لازم")
    : s === "Communicated"
      ? t("Communicated — acknowledgement needed", "اطلاع دی — تسلیم باقی")
      : t("Acknowledged — final", "تسلیم شدہ — حتمی");
type Props = {
  user: ClinicalUser;
  connected: boolean;
  stream: string;
  establishment: EstablishmentOut;
  timeZone?: string;
};
const screenView = (est: EstablishmentOut) =>
  est.views.screens.find((s) => s.screen_id === "critical_results_doctor")
    ?.view || "hidden";

// Remains mounted throughout the permitted workspace, independent of history filters.
export function DoctorCriticalAlert({
  user,
  establishment,
  onOpen,
}: {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  onOpen: () => void;
}) {
  const access = doctorCriticalAccess(
    user.permissions,
    screenView(establishment),
  );
  const [revision, setRevision] = useState(0),
    [alarmError, setAlarmError] = useState<unknown>();
  const pending = useLoad(
    () =>
      access.work
        ? critical.listCritical({ mine: true, open_only: true, limit: 1000 })
        : Promise.resolve([]),
    [access.work, revision],
  );
  useEffect(() => {
    let active = true;
    const refresh = () => setRevision((n) => n + 1);
    window.addEventListener("doctor-critical-refresh", refresh);
    const unsubscribe = window.terminal.subscribe((e) => {
      if (e.type === "event" && e.event_type === "critical_result.updated") {
        refresh();
        if (
          access.work &&
          e.payload?.change === "Opened" &&
          Number.isSafeInteger(e.payload?.critical_result_id)
        ) {
          const id = e.payload.critical_result_id;
          void critical
            .listCritical({
              mine: true,
              open_only: true,
              patient_id: e.payload.patient_id,
              limit: 1000,
            })
            .then(async (rows) => {
              if (active && rows.some((r) => r.critical_result_id === id))
                await call("critical-result-alarm", { criticalResultId: id });
            })
            .catch((e) => {
              if (active) setAlarmError(e);
            });
        }
      }
      if (e.type === "stream" && e.status === "Live" && e.resync) refresh();
    });
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("doctor-critical-refresh", refresh);
    };
  }, [access.work, user.user_id]);
  useEffect(() => {
    if (!pending.loading && !pending.error && pending.data?.length === 0)
      setAlarmError(undefined);
  }, [pending.loading, pending.error, pending.data]);
  const count =
    pending.data?.filter((r) => r.status !== "Acknowledged").length || 0;
  if (
    !access.work ||
    (!count && !pending.loading && !pending.error && !alarmError)
  )
    return null;
  return (
    <aside
      className="bench-critical critical-diagnostic doctor-critical-alert"
      role="alert"
      data-testid="doctor-critical-alert"
      data-help-screen="critical_results_doctor"
    >
      <strong>
        {count
          ? t(
              "Critical results awaiting your acknowledgement",
              "آپ کی تسلیم کے منتظر اہم نتائج",
            ) + `: ${count}${count === 1000 ? "+" : ""}`
          : t("Checking your critical results", "آپ کے اہم نتائج کی جانچ")}
      </strong>
      <p>
        {t(
          "Assess the patient now and record the action taken. This alert stays until the server confirms acknowledgement.",
          "مریض کا ابھی جائزہ لیں اور اصل کارروائی درج کریں۔ سرور کی تسلیم تک یہ تنبیہ رہے گی۔",
        )}
        {(pending.loading || !!pending.error) &&
          t(" The last check is not current.", " آخری جانچ تازہ نہیں۔")}
      </p>
      <ErrorBox error={pending.error} />
      <ErrorBox error={alarmError} />
      <button data-help="critical-doctor.alert" onClick={onOpen}>
        {t("Review critical results", "اہم نتائج کا جائزہ")}
      </button>
      {!!pending.error && (
        <button data-help="critical-doctor.refresh" onClick={pending.reload}>
          {t("Check critical alerts again", "اہم تنبیہ پھر جانچیں")}
        </button>
      )}
    </aside>
  );
}

export function CriticalResultsDoctor({
  user,
  connected,
  stream,
  establishment,
  timeZone,
}: Props) {
  const view = screenView(establishment),
    access = doctorCriticalAccess(user.permissions, view),
    live = connected && stream === "Live";
  const [revision, setRevision] = useState(0),
    [detailRevision, setDetailRevision] = useState(0);
  const [onlyOpen, setOnlyOpen] = useState(true),
    [source, setSource] = useState(""),
    [status, setStatus] = useState(""),
    [limit, setLimit] = useState("200"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [find, setFind] = useState("");
  const [filters, setFilters] = useState<
    Parameters<typeof critical.listCritical>[0]
  >({ mine: true, open_only: true, limit: 200 });
  const [id, setId] = useState(0),
    [lookup, setLookup] = useState(""),
    [action, setAction] = useState(""),
    [error, setError] = useState<unknown>(),
    [notice, setNotice] = useState(false),
    [pdfBusy, setPdfBusy] = useState(false),
    [pdfNotice, setPdfNotice] = useState<"opened" | "saved" | "cancelled">();
  const [review, setReview] = useState<{
      record: critical.CriticalResultDetailOut;
      body: critical.AcknowledgeIn;
    }>(),
    [submitted, setSubmitted] = useState(false);
  const currentId = useRef(id),
    pdfFlight = useRef(false);
  currentId.current = id;
  const list = useLoad(
    () =>
      access.read
        ? critical.listCritical({
            ...filters,
            mine: true,
            ...(view === "records" ? { open_only: false } : {}),
          })
        : Promise.resolve([]),
    [access.read, view, filters, revision],
  );
  const work = useLoad(
    () =>
      access.work
        ? critical.diagnosticsWorklist({ mine: true })
        : Promise.resolve([]),
    [access.work, revision],
  );
  const detail = useLoad(
    () =>
      access.read && id ? critical.getCritical(id) : Promise.resolve(undefined),
    [access.read, view, id, detailRevision],
  );
  const record =
    !detail.loading && !detail.error && detail.data?.critical_result_id === id
      ? detail.data
      : undefined;
  const rows =
    !list.loading && !list.error
      ? (list.data || []).filter((r) =>
          `${r.critical_number} ${r.patient_name} ${r.mrn} ${r.test_name} ${r.finding}`
            .toLowerCase()
            .includes(find.trim().toLowerCase()),
        )
      : [];
  const tasks =
    !work.loading && !work.error ? doctorCriticalWork(work.data || []) : [];
  const refresh = () => {
    setRevision((n) => n + 1);
    setDetailRevision((n) => n + 1);
    refreshAlerts();
  };
  const write = useClinicalWrite(
    user,
    `critical-doctor:${id}`,
    async (value) => {
      const saved = value as critical.CriticalResultDetailOut;
      setReview(undefined);
      setAction("");
      setNotice(
        saved.critical_result_id === currentId.current &&
          saved.status === "Acknowledged",
      );
      refresh();
    },
  );
  const blocked = write.blocked || pdfBusy,
    dirty = !!action.trim();
  useEffect(
    () =>
      window.terminal.subscribe((e) => {
        if (e.type === "event" && e.event_type === "critical_result.updated") {
          setRevision((n) => n + 1);
          if (e.payload?.critical_result_id === currentId.current)
            setDetailRevision((n) => n + 1);
        }
        if (e.type === "stream" && e.status === "Live" && e.resync) {
          setRevision((n) => n + 1);
          setDetailRevision((n) => n + 1);
        }
      }),
    [],
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
  useEffect(() => {
    const code =
      write.error instanceof ApiError
        ? write.error.response.error?.code
        : undefined;
    if (
      code &&
      [
        "VERSION_CONFLICT",
        "CRITICAL_RESULT_STATE_INVALID",
        "CRITICAL_RESULT_ACKNOWLEDGER_INVALID",
        "FORBIDDEN",
      ].includes(code)
    )
      refresh();
  }, [write.error]);
  const time = (value?: string | null) =>
    value
      ? timeZone
        ? formatHospitalTime(value, timeZone)
        : value
      : t("Not recorded", "درج نہیں");
  function open(next: number) {
    if (blocked || review) return;
    if (!Number.isSafeInteger(next) || next < 1) {
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
      next !== id &&
      dirty &&
      !window.confirm(
        t(
          "Discard this unsent action draft and change result?",
          "غیر ارسال کارروائی کا مسودہ چھوڑ کر نتیجہ بدلیں؟",
        ),
      )
    )
      return;
    if (next !== id) {
      setAction("");
      setNotice(false);
      setPdfNotice(undefined);
    }
    setError(undefined);
    setId(next);
    setLookup(String(next));
    setDetailRevision((n) => n + 1);
  }
  function prepare() {
    if (!record || blocked || !access.acknowledge || !live) return;
    setError(undefined);
    try {
      setReview({ record, body: acknowledgementBody(record, action) });
      setSubmitted(false);
    } catch (e) {
      setError(e);
    }
  }
  function confirm() {
    if (!review || blocked || submitted || !live) return;
    const frozen = review;
    setSubmitted(true);
    write.start(
      {
        method: "POST",
        path: `/critical-results/${frozen.record.critical_result_id}/acknowledge`,
        body: frozen.body,
        permission: "diagnostics.critical.acknowledge",
        protection: "reconcile",
        reconcilePath: `/critical-results/${frozen.record.critical_result_id}`,
        label: t(
          "Acknowledge critical result with action taken",
          "اہم نتیجہ اصل کارروائی کے ساتھ تسلیم کریں",
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
          !doctorCriticalAccess(me.permissions, screenView(est)).acknowledge ||
          acknowledgementSnapshot(fresh) !==
            acknowledgementSnapshot(frozen.record)
        )
          throw Error(
            t(
              "The result, history, permission or service changed. Close and review the current record again.",
              "نتیجہ، تاریخ، اجازت یا خدمت بدل گئی۔ بند کرکے تازہ ریکارڈ کا پھر جائزہ لیں۔",
            ),
          );
        acknowledgementBody(fresh, frozen.body.action_taken);
      },
    );
  }
  async function report(preview: boolean) {
    if (!record || blocked || pdfFlight.current || review) return;
    const frozen = record;
    pdfFlight.current = true;
    setPdfNotice(undefined);
    setPdfBusy(true);
    setError(undefined);
    try {
      const [fresh, me, est] = await Promise.all([
        critical.getCritical(frozen.critical_result_id),
        api<ClinicalUser>("GET", "/auth/me"),
        api<EstablishmentOut>("GET", "/establishment"),
      ]);
      if (
        me.user_id !== user.user_id ||
        !doctorCriticalAccess(me.permissions, screenView(est)).read ||
        acknowledgementSnapshot(fresh) !== acknowledgementSnapshot(frozen)
      )
        throw Error(
          t(
            "The report context changed. Refresh this result before opening its report.",
            "رپورٹ کا سیاق بدل گیا۔ کھولنے سے پہلے نتیجہ تازہ کریں۔",
          ),
        );
      const doc = criticalReport(fresh, me.permissions);
      if (!doc)
        throw Error(
          t(
            "The report link or permission is unavailable. Ask the diagnostic team.",
            "رپورٹ کا ربط یا اجازت نہیں۔ تشخیصی ٹیم سے رابطہ کریں۔",
          ),
        );
      const outcome = await call("clinical-pdf", { path: doc.path, preview });
      setPdfNotice(
        outcome.opened ? "opened" : outcome.saved ? "saved" : "cancelled",
      );
    } catch (e) {
      setError(e);
    } finally {
      pdfFlight.current = false;
      setPdfBusy(false);
    }
  }
  const observed = write.observed as
    critical.CriticalResultDetailOut | undefined;
  const matches =
    !!review &&
    observed?.critical_result_id === review.record.critical_result_id &&
    observed?.patient_id === review.record.patient_id &&
    observed?.source === review.record.source;
  function reconciled() {
    if (matches && observed?.status === "Acknowledged") {
      setAction("");
      setNotice(
        observed.acknowledged_by === user.user_id &&
          observed.action_taken === review?.body.action_taken,
      );
    }
    setReview(undefined);
    refresh();
  }
  if (!access.read)
    return (
      <Empty>
        {t(
          "Critical results are unavailable or viewing permission is missing.",
          "اہم نتائج دستیاب نہیں یا پڑھنے کی اجازت نہیں۔",
        )}
      </Empty>
    );
  return (
    <section
      className="critical-bench-screen"
      data-help-screen="critical_results_doctor"
      data-write-pending={blocked}
      data-unsaved={dirty && !blocked}
    >
      <header className="section-heading">
        <div>
          <h1>
            {t("Critical results to acknowledge", "تسلیم کرنے والے اہم نتائج")}
          </h1>
          <p>
            {t(
              "Assess the patient and record what you actually did. Acknowledgement is final.",
              "مریض کا جائزہ لے کر اصل کی گئی کارروائی درج کریں۔ تسلیم حتمی ہے۔",
            )}
          </p>
        </div>
        <button
          data-help="critical-doctor.refresh"
          disabled={blocked}
          onClick={refresh}
        >
          {t("Refresh my critical results", "میرے اہم نتائج تازہ کریں")}
        </button>
      </header>
      <p className="muted">
        {live
          ? t("Live", "لائیو")
          : t(
              "Disconnected or reconnecting — acknowledgement is blocked.",
              "رابطہ منقطع یا بحال ہو رہا ہے — تسلیم بند۔",
            )}
      </p>
      {view === "open_work" && (
        <p className="notice">
          {t(
            "No new diagnostic work from now on; complete existing critical-result acknowledgements.",
            "اب نیا تشخیصی کام نہیں؛ موجودہ اہم نتائج کی تسلیم مکمل کریں۔",
          )}
        </p>
      )}
      {view === "records" && (
        <p className="notice">
          {t(
            "Records — history only; no new acknowledgement.",
            "ریکارڈ — صرف تاریخ؛ نئی تسلیم نہیں۔",
          )}
        </p>
      )}
      <ErrorBox error={error} />
      {pdfNotice && (
        <p role="status">
          {pdfNotice === "opened"
            ? t(
                "Report opened separately. Acknowledgement is unchanged.",
                "رپورٹ الگ کھلی۔ تسلیم نہیں بدلی۔",
              )
            : pdfNotice === "saved"
              ? t(
                  "Report PDF saved. Acknowledgement is unchanged.",
                  "رپورٹ پی ڈی ایف محفوظ۔ تسلیم نہیں بدلی۔",
                )
              : t(
                  "Report opening or save cancelled. Acknowledgement is unchanged.",
                  "رپورٹ کھولنا یا محفوظ منسوخ۔ تسلیم نہیں بدلی۔",
                )}
        </p>
      )}
      {notice && (
        <p role="status">
          {t(
            "Acknowledgement confirmed on the server. The recorded action is final.",
            "سرور پر تسلیم کی تصدیق۔ درج کارروائی حتمی ہے۔",
          )}
        </p>
      )}
      {!review && <ErrorBox error={write.error} verbatim />}
      <fieldset disabled={blocked || !!review}>
        <div className="critical-bench-layout">
          {access.work && (
            <section className="card critical-work">
              <h2>
                {t(
                  "My urgent acknowledgement worklist",
                  "میری فوری تسلیم کی فہرست",
                )}
              </h2>
              <LoadState {...work} retry={work.reload} />
              {!work.loading && !work.error && !tasks.length && (
                <p>
                  {t(
                    "No acknowledgement is pending for your patients in this worklist.",
                    "اس فہرست میں آپ کے مریضوں کی تسلیم باقی نہیں۔",
                  )}
                </p>
              )}
              {tasks.map((r, i) => (
                <article key={`${r.critical_result_id}:${i}`}>
                  <p>
                    <bdi>
                      {r.patient_name} · {r.mrn} · {r.title}
                    </bdi>
                    {r.is_overdue && (
                      <strong className="error">
                        {t(" OVERDUE", " تاخیر")}
                      </strong>
                    )}
                  </p>
                  <button
                    data-help="critical-doctor.open"
                    onClick={() => open(r.critical_result_id!)}
                  >
                    {t("Review urgent result", "فوری نتیجہ دیکھیں")}
                  </button>
                </article>
              ))}
            </section>
          )}
          <section className="card critical-log">
            <h2>{t("My critical results log", "میرے اہم نتائج کا رجسٹر")}</h2>
            <p>
              {t(
                "My patients means I ordered the test or I am the consultant. History filters never clear the workspace alert.",
                "میرے مریض یعنی ٹیسٹ مانگنے والا یا کنسلٹنٹ میں ہوں۔ تاریخ کی چھانٹی کام کی تنبیہ نہیں ہٹاتی۔",
              )}
            </p>
            <div className="form-grid">
              <Field label={t("Diagnostic source", "تشخیصی ماخذ")}>
                <select
                  data-help="critical-doctor.filters"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  <option value="">
                    {t("Lab and imaging", "لیب اور عکس")}
                  </option>
                  <option value="Lab">{t("Laboratory", "لیب")}</option>
                  <option value="Imaging">{t("Imaging", "عکس")}</option>
                </select>
              </Field>
              <Field label={t("Result status", "نتیجے کی حالت")}>
                <select
                  data-help="critical-doctor.filters"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">{t("All statuses", "تمام حالتیں")}</option>
                  {["Open", "Communicated", "Acknowledged"].map((s) => (
                    <option key={s} value={s}>
                      {stateLabel(s)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("From date", "ابتدائی تاریخ")}>
                <input
                  data-help="critical-doctor.filters"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </Field>
              <Field label={t("To date", "آخری تاریخ")}>
                <input
                  data-help="critical-doctor.filters"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
              <Field
                label={t("Maximum results (1–1000)", "نتائج کی حد (1–1000)")}
              >
                <input
                  data-help="critical-doctor.filters"
                  inputMode="numeric"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                />
              </Field>
            </div>
            {view !== "records" && (
              <label>
                <input
                  data-help="critical-doctor.filters"
                  type="checkbox"
                  checked={onlyOpen}
                  onChange={(e) => setOnlyOpen(e.target.checked)}
                />
                {t("Not yet acknowledged only", "صرف تسلیم کے منتظر")}
              </label>
            )}
            <button
              data-help="critical-doctor.filters"
              onClick={() => {
                try {
                  const q = criticalFilters(limit, from, to);
                  setFilters({
                    ...q,
                    mine: true,
                    open_only: onlyOpen,
                    source: (source || undefined) as
                      "Lab" | "Imaging" | undefined,
                    status: (status || undefined) as
                      critical.CriticalResultOut["status"] | undefined,
                  });
                  setError(undefined);
                } catch (e) {
                  setError(e);
                }
              }}
            >
              {t("Apply log filters", "رجسٹر کی چھانٹی لگائیں")}
            </button>
            <Field
              label={t(
                "Find in returned critical results",
                "موصولہ اہم نتائج میں تلاش",
              )}
            >
              <input
                data-help="critical-doctor.find"
                value={find}
                onChange={(e) => setFind(e.target.value)}
              />
            </Field>
            <LoadState {...list} retry={list.reload} />
            {!list.loading && !list.error && !rows.length && (
              <p>
                {t(
                  "No results match these filters. Clear local search or widen history filters.",
                  "چھانٹی میں کوئی نتیجہ نہیں۔ تلاش صاف یا تاریخ وسیع کریں۔",
                )}
              </p>
            )}
            {rows.map((r) => (
              <article
                key={r.critical_result_id}
                data-testid="doctor-critical-log-row"
              >
                <p>
                  <bdi>
                    {r.critical_number} · {r.patient_name} · {r.mrn}
                  </bdi>
                </p>
                <p>
                  {stateLabel(r.status)} ·{" "}
                  <bdi>
                    {r.test_name}: {r.finding}
                  </bdi>
                  {r.is_overdue && (
                    <strong className="error">{t(" OVERDUE", " تاخیر")}</strong>
                  )}
                </p>
                <button
                  data-help="critical-doctor.open"
                  onClick={() => open(r.critical_result_id)}
                >
                  {t("Open critical result", "اہم نتیجہ کھولیں")}
                </button>
              </article>
            ))}
            {!list.loading &&
              !list.error &&
              list.data?.length === filters?.limit && (
                <p>
                  {t(
                    "Result limit reached. Narrow server filters to find more precisely.",
                    "نتائج کی حد پوری۔ سرور چھانٹی مزید محدود کریں۔",
                  )}
                </p>
              )}
          </section>
          <section className="card critical-current">
            <div className="form-grid">
              <Field
                label={t("Known critical result ID", "اہم نتیجے کا معلوم نمبر")}
              >
                <input
                  data-help="critical-doctor.open"
                  value={lookup}
                  inputMode="numeric"
                  onChange={(e) => setLookup(e.target.value)}
                />
              </Field>
              <button
                data-help="critical-doctor.open"
                onClick={() => open(/^\d+$/.test(lookup) ? Number(lookup) : 0)}
              >
                {t("Read known critical result", "معلوم اہم نتیجہ پڑھیں")}
              </button>
            </div>
            <LoadState {...detail} retry={detail.reload} />
            {!id && (
              <p>
                {t(
                  "Select a result to review its patient and action.",
                  "مریض اور کارروائی دیکھنے کو نتیجہ چنیں۔",
                )}
              </p>
            )}
            {record && (
              <>
                <div
                  className={
                    record.status === "Acknowledged"
                      ? "notice"
                      : "bench-critical"
                  }
                  data-testid="doctor-critical-detail"
                >
                  <h2>
                    <bdi>
                      {record.critical_number} · {record.patient_name} ·{" "}
                      {record.mrn}
                    </bdi>
                  </h2>
                  <strong>
                    {stateLabel(record.status)}
                    {record.is_overdue && t(" · OVERDUE", " · تاخیر")}
                  </strong>
                  <p>
                    <bdi>
                      {record.test_name}: {record.finding}
                    </bdi>
                  </p>
                  <p>
                    {t("Requesting doctor", "مانگنے والا معالج")}:{" "}
                    <bdi>
                      {record.requester_doctor_name ||
                        t("Not recorded", "درج نہیں")}
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
                    {t("Escalation level / time", "اگلی اطلاع کی سطح / وقت")}:{" "}
                    <bdi>
                      {record.escalation_level} · {time(record.escalated_at)}
                    </bdi>
                  </p>
                  {record.notifiable_disease && (
                    <p>
                      <bdi>{record.notifiable_disease}</bdi> ·{" "}
                      {record.authority_pending
                        ? t(
                            "Health authority notification still required",
                            "ادارۂ صحت اطلاع باقی",
                          )
                        : t(
                            "Health authority informed",
                            "ادارۂ صحت کو اطلاع دی",
                          )}{" "}
                      · <bdi>{time(record.authority_informed_at)}</bdi>
                    </p>
                  )}
                  <p>
                    {t("Acknowledged by / time", "تسلیم کرنے والا / وقت")}:{" "}
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
                </div>
                {criticalReport(record, user.permissions) ? (
                  <div className="actions">
                    <button
                      data-help="critical-doctor.report"
                      onClick={() => void report(true)}
                    >
                      {record.source === "Lab"
                        ? t("Open laboratory report", "لیب رپورٹ کھولیں")
                        : t("Open imaging report", "عکس رپورٹ کھولیں")}
                    </button>
                    <button
                      data-help="critical-doctor.report"
                      onClick={() => void report(false)}
                    >
                      {t("Save report PDF", "رپورٹ پی ڈی ایف محفوظ کریں")}
                    </button>
                  </div>
                ) : (
                  <p>
                    {t(
                      "Report link or permission unavailable; ask the diagnostic team.",
                      "رپورٹ ربط یا اجازت نہیں؛ تشخیصی ٹیم سے رابطہ کریں۔",
                    )}
                  </p>
                )}
                <section data-testid="doctor-critical-history">
                  <h3>{t("Communication history", "اطلاعات کی تاریخ")}</h3>
                  {!record.communications.length && (
                    <p>
                      {t(
                        "No recorded communication. You may assess and acknowledge directly; do not wait for a phone call.",
                        "کوئی اطلاع درج نہیں۔ خود جائزہ و تسلیم کر سکتے ہیں؛ فون کا انتظار نہ کریں۔",
                      )}
                    </p>
                  )}
                  {record.communications.map((c) => (
                    <article className="card" key={c.communication_id}>
                      <p>
                        <bdi>{c.recipient_name}</bdi> · {communicationLabel(c.recipient_role)} ·{" "}
                        {communicationLabel(c.means)}
                      </p>
                      <p>
                        {t("Read back", "دہرا کر تصدیق")}:{" "}
                        {c.read_back ? t("Yes", "ہاں") : t("No", "نہیں")} ·{" "}
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
                {access.acknowledge && record.status !== "Acknowledged" && (
                  <section>
                    <h3>
                      {t("Record the action taken", "کی گئی کارروائی درج کریں")}
                    </h3>
                    <p>
                      {t(
                        "Write only what you actually did. This acknowledgement is final; the server decides whether you may treat this patient.",
                        "صرف اصل کی گئی کارروائی لکھیں۔ تسلیم حتمی؛ اس مریض کے علاج کی اجازت سرور طے کرے۔",
                      )}
                    </p>
                    <Field
                      label={t(
                        "Action taken (3–2000 characters)",
                        "کی گئی کارروائی (3–2000 حروف)",
                      )}
                    >
                      <textarea
                        data-help="critical-doctor.action"
                        value={action}
                        maxLength={2000}
                        disabled={!live}
                        onChange={(e) => setAction(e.target.value)}
                      />
                    </Field>
                    <button
                      data-help="critical-doctor.review"
                      disabled={!live}
                      onClick={prepare}
                    >
                      {t("Review acknowledgement", "تسلیم کا جائزہ")}
                    </button>
                  </section>
                )}
              </>
            )}
          </section>
        </div>
      </fieldset>
      {review && (
        <Modal
          title={t("Confirm final acknowledgement", "حتمی تسلیم کی تصدیق")}
          closable={!write.blocked}
          onClose={() => {
            if (!write.blocked) {
              setReview(undefined);
              setDetailRevision((n) => n + 1);
            }
          }}
        >
          <div data-help-screen="critical_results_doctor">
            <p>
              <bdi>
                {review.record.critical_number} · {review.record.patient_name} ·{" "}
                {review.record.mrn}
              </bdi>
            </p>
            <p>
              <bdi>{review.record.finding}</bdi>
            </p>
            <p>
              {t("Action taken", "کی گئی کارروائی")}:{" "}
              <bdi>{review.body.action_taken}</bdi>
            </p>
            <p>
              {t(
                "This closes the critical result. It cannot be edited or acknowledged again.",
                "یہ اہم نتیجہ بند کرتا ہے۔ پھر ترمیم یا دوبارہ تسلیم نہیں۔",
              )}
            </p>
            <ClinicalWriteFeedback
              write={{
                ...write,
                notice: "",
                checked: write.checked && matches,
              }}
              onReviewed={reconciled}
            />
            {write.checked && !matches && (
              <p className="error">
                {t(
                  "The returned identity does not match. Ask IT to reconcile; do not submit another acknowledgement.",
                  "لوٹی شناخت مختلف۔ آئی ٹی سے نتیجہ چیک؛ نئی تسلیم نہ بھیجیں۔",
                )}
              </p>
            )}
            <button
              data-help="critical-doctor.confirm"
              disabled={write.blocked || submitted || !live}
              onClick={confirm}
            >
              {t(
                "Confirm action and acknowledge",
                "کارروائی کی تصدیق اور تسلیم",
              )}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
