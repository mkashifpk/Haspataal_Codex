import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import * as api from "../generated/incident_statistics";
import { call } from "../bridge";
import { ErrorBox, Field, Modal } from "../components";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";
import { formatHospitalTime } from "../hospital-time";
export function IncidentStatistics({
  screenId = "incident_statistics",
  user,
  revision,
  connected,
  readOnly,
  timeZone,
  onOpenHelp,
}: {
  screenId?: "incident_statistics"|"incident_statistics_owner";
  user: ClinicalUser;
  revision: number;
  connected: boolean;
  readOnly: boolean;
  timeZone?: string;
  onOpenHelp: () => void;
}) {
  const [data, setData] = useState<api.IncidentStatisticsOut>(),
    [reports, setReports] = useState<api.IncidentOut[]>([]),
    [returns, setReturns] = useState<api.MonthlyReturnOut[]>([]),
    [error, setError] = useState<unknown>(),
    [loading, setLoading] = useState(false),
    [query, setQuery] = useState<{ date_from?: string; date_to?: string }>({}),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [months, setMonths] = useState(12),
    [month, setMonth] = useState<api.MonthlyReturnOut>(),
    [reviewed, setReviewed] = useState(false),
    [paperBusy, setPaperBusy] = useState(false),
    [paperError, setPaperError] = useState<unknown>(),
    [notice, setNotice] = useState("");
  const generation = useRef(0);
  const load = useCallback(async () => {
    const n = ++generation.current;
    setLoading(true);
    setError(undefined);
    setReviewed(false);
    try {
      const s = await api.incidentStatistics(query),
        [r, i] = await Promise.all([
          api.listReturnsQualityMonthly({ kind: "SentinelEvents", months }),
          api.listIncidents({
            date_from: s.date_from,
            date_to: s.date_to,
            limit: 1000,
          }),
        ]);
      if (n === generation.current) {
        setData(s);
        setFrom((v) => v || s.date_from);
        setTo((v) => v || s.date_to);
        setReturns(r);
        setReports(i);
      }
    } catch (e) {
      if (n === generation.current) setError(e);
    } finally {
      if (n === generation.current) setLoading(false);
    }
  }, [query, months]);
  useEffect(() => {
    void load();
    return () => {
      ++generation.current;
    };
  }, [load, revision]);
  const write = useClinicalWrite(user, screenId, async () => {
      setMonth(undefined);
      setReviewed(false);
      await load();
    }),
    blocked = write.blocked || paperBusy,
    editable = connected && !readOnly && !loading && !error && !blocked,
    canConfirm = user.permissions.includes("incident.manage");
  useEffect(() => {
    if (write.error && !write.blocked) void load();
  }, [write.error, write.blocked, load]);
  function confirmReturn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!month || !reviewed || !canConfirm || !editable) return;
    const f = new FormData(e.currentTarget),
      selected = month.month;
    write.start(
      {
        method: "POST",
        path: "/quality/monthly-returns",
        body: {
          kind: "SentinelEvents",
          month: selected,
          note: String(f.get("note") ?? "").trim() || null,
        } satisfies api.MonthlyReturnIn,
        permission: "incident.manage",
        protection: "idempotent",
        reconcilePath: "/quality/monthly-returns?kind=SentinelEvents&months=36",
        label: t(
          "Confirm this sentinel event month",
          "سنگین واقعات کا یہ ماہ تصدیق کریں",
        ),
      },
      async () => {
        const current = await api.listReturnsQualityMonthly({
            kind: "SentinelEvents",
            months: 36,
          }),
          row = current.find((r) => r.month === selected);
        if (
          !row ||
          row.confirmed ||
          row.entries !== month.entries ||
          row.numbers.join() !== month.numbers.join()
        )
          throw Error(
            t(
              "This month changed. Refresh and review its current entries or confirmation stamp.",
              "یہ ماہ بدل گیا۔ تازہ پڑھ کر موجودہ اندراج یا مہر چیک کریں۔",
            ),
          );
      },
    );
  }
  async function document(preview = false) {
    if (!connected || blocked || loading || error || !data) return;
    setPaperBusy(true);
    setPaperError(undefined);
    setNotice("");
    try {
      const r = await call("clinical-pdf", {
        path:
          "/incidents/register/pdf?date_from=" +
          data.date_from +
          "&date_to=" +
          data.date_to,
        preview,
      });
      setNotice(
        preview
          ? t("Server incident PDF opened.", "سرور واقعہ پی ڈی ایف کھلی۔")
          : r.saved
            ? t("Server incident PDF saved.", "سرور واقعہ پی ڈی ایف محفوظ۔")
            : t(
                "PDF save cancelled; no return was confirmed.",
                "پی ڈی ایف محفوظ منسوخ؛ ماہ کی تصدیق نہیں ہوئی۔",
              ),
      );
    } catch (e) {
      setPaperError(e);
    } finally {
      setPaperBusy(false);
    }
  }
  const time = (v: string | null) =>
    v == null
      ? t("Not recorded", "درج نہیں")
      : timeZone
        ? formatHospitalTime(v, timeZone)
        : v;
  const metric = (label: string, value: number | string) => (
    <div className="metric" key={label}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
  function breakdown(title: string, rows: api.IncidentCountOut[]) {
    const max = Math.max(1, ...rows.map((r) => r.count));
    return (
      <div>
        <h3>{title}</h3>
        {rows.length ? (
          <>
            <svg
              role="img"
              aria-label={title}
              viewBox={`0 0 420 ${rows.length * 30}`}
              style={{ maxHeight: 300, width: "100%" }}
            >
              {rows.map((r, i) => (
                <g key={r.key}>
                  <text x="0" y={i * 30 + 18} fill="currentColor" fontSize="12">
                    {r.key}
                  </text>
                  <rect
                    x="180"
                    y={i * 30 + 4}
                    width={(r.count / max) * 180}
                    height="18"
                    fill="currentColor"
                  />
                  <text
                    x="370"
                    y={i * 30 + 18}
                    fill="currentColor"
                    fontSize="12"
                  >
                    {r.count}
                  </text>
                </g>
              ))}
            </svg>
            <table>
              <caption>{title}</caption>
              <thead>
                <tr>
                  <th>{t("Group", "گروہ")}</th>
                  <th>{t("Count", "تعداد")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.key}</td>
                    <td>{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p>
            {t("No entries in this period.", "اس مدت میں کوئی اندراج نہیں۔")}
          </p>
        )}
      </div>
    );
  }
  return (
    <section
      data-screen={screenId}
      data-unsaved={!!month}
      data-write-pending={write.blocked}
    >
      <div className="section-heading">
        <div>
          <h1>
            {t(
              "Patient safety statistics and sentinel returns",
              "مریض حفاظت کے اعداد اور سنگین واقعات کی رپورٹ",
            )}
          </h1>
          <p>
            {t(
              "For the quality committee: examine reporting, harm, analysis, actions and documented monthly returns.",
              "کوالٹی کمیٹی کے لیے: رپورٹنگ، نقصان، تجزیہ، اعمال اور ماہانہ تصدیق دیکھیں۔",
            )}
          </p>
        </div>
        <div className="toolbar">
          <button
            data-help="ist.refresh"
            disabled={write.busy || paperBusy}
            onClick={() => void load()}
          >
            {t("Refresh safety report", "حفاظت رپورٹ تازہ کریں")}
          </button>
          <button data-help="ist.help" onClick={onOpenHelp}>
            {t("Help / F1", "مدد / ایف ون")}
          </button>
        </div>
      </div>
      {!connected && (
        <p role="alert">
          {t(
            "Disconnected. Data may be stale; no confirmation is queued offline.",
            "رابطہ نہیں۔ معلومات پرانی ہو سکتیں؛ آف لائن تصدیق جمع نہیں۔",
          )}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (blocked || month || from > to) return;
          setQuery({ date_from: from, date_to: to });
        }}
      >
        <fieldset disabled={blocked || !!month}>
          <legend>
            {t(
              "Incidents that occurred in this period",
              "اس مدت میں پیش آنے والے واقعات",
            )}
          </legend>
          <div className="form-grid">
            <Field label={t("From", "سے")}>
              <input
                data-help="ist.period"
                name="date_from"
                type="date"
                required
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
            <Field label={t("To", "تک")}>
              <input
                data-help="ist.period"
                name="date_to"
                type="date"
                required
                min={from}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
          </div>
          <button data-help="ist.apply">
            {t("Apply safety period", "حفاظت کی مدت لگائیں")}
          </button>
        </fieldset>
      </form>
      {loading && (
        <p role="status">
          {t("Reading safety evidence…", "حفاظت کے شواہد پڑھے جا رہے ہیں…")}
        </p>
      )}
      <ErrorBox error={error} />
      {!loading && !error && data && (
        <>
          <p>
            {t("Applied period", "لاگو مدت")}: {data.date_from} — {data.date_to}
          </p>
          <div className="metric-grid">
            {[
              [
                t("Reports (withdrawn excluded)", "رپورٹیں (واپس لی گئی خارج)"),
                data.reported,
              ],
              [t("Incidents", "واقعات"), data.incidents],
              [t("Near misses", "بال بال بچاؤ"), data.near_misses],
              [t("Sentinel events", "سنگین واقعات"), data.sentinel_events],
              [t("Inpatient days", "داخل مریض دن"), data.patient_days],
              [
                t(
                  "Reports per 1,000 inpatient days",
                  "فی ہزار داخل مریض دن رپورٹ",
                ),
                data.reports_per_1000_patient_days ??
                  t(
                    "Not available: no inpatient days",
                    "دستیاب نہیں: داخل مریض دن نہیں",
                  ),
              ],
            ].map(([l, v]) => metric(String(l), v))}
          </div>
          <p className="notice">
            {t(
              "A low reporting rate is a warning about reporting, not a success measure. Check ward, theatre, death and screening sources with the clinical team.",
              "کم رپورٹ شرح رپورٹنگ کی تنبیہ ہے، کامیابی نہیں۔ طبی ٹیم کے ساتھ وارڈ، تھیٹر، وفات اور چھان بین کے ذرائع چیک کریں۔",
            )}
          </p>
          {data.reported === 0 && (
            <p>
              {t(
                "No reports in this period. This does not confirm a nil monthly return.",
                "اس مدت میں رپورٹ نہیں۔ اس سے ماہ کی خالی رپورٹ تصدیق نہیں ہوتی۔",
              )}
            </p>
          )}
          <div className="form-grid">
            {breakdown(t("By area", "شعبہ وار"), data.by_area)}
            {breakdown(t("By harm", "نقصان وار"), data.by_harm)}
            {breakdown(t("By type", "قسم وار"), data.by_type)}
            {breakdown(t("By department", "محکمہ وار"), data.by_department)}
            {breakdown(
              t(
                "Contributing factors in signed analyses",
                "دستخط شدہ تجزیوں کے عوامل",
              ),
              data.contributing_factors,
            )}
          </div>
          <h2>{t("By month", "ماہ وار")}</h2>
          <div className="form-grid">
            {breakdown(
              t("Monthly incidents", "ماہانہ واقعات"),
              data.by_month.map((r) => ({ key: r.month, count: r.incidents })),
            )}
            {breakdown(
              t("Monthly near misses", "ماہانہ بال بال بچاؤ"),
              data.by_month.map((r) => ({
                key: r.month,
                count: r.near_misses,
              })),
            )}
            {breakdown(
              t("Monthly sentinel events", "ماہانہ سنگین واقعات"),
              data.by_month.map((r) => ({ key: r.month, count: r.sentinel })),
            )}
          </div>
          <h2>
            {t(
              "Medication, anaesthesia and transfusion safety",
              "دوا، بے ہوشی اور انتقال خون کی حفاظت",
            )}
          </h2>
          <div className="metric-grid">
            {[
              [t("Medication errors", "دوا کی غلطیاں"), data.medication.errors],
              [
                t(
                  "Errors on high-alert medicines",
                  "زیادہ خطرے کی دوا کی غلطیاں",
                ),
                data.medication.errors_high_alert,
              ],
              [
                t("Adverse drug reactions", "دوا کے مضر ردعمل"),
                data.medication.adverse_drug_reactions,
              ],
              [
                t("ADRs on high-alert medicines", "زیادہ خطرے کی دوا کے ردعمل"),
                data.medication.adverse_drug_reactions_high_alert,
              ],
              [
                t("Anaesthesia events", "بے ہوشی واقعات"),
                data.anaesthesia_events,
              ],
              [t("Surgical events", "جراحی واقعات"), data.surgical_events],
              [
                t("Transfusion reactions", "خون کے ردعمل"),
                data.transfusion_reactions,
              ],
            ].map(([l, v]) => metric(String(l), v))}
          </div>
          {breakdown(
            t("Medication errors by stage", "مرحلہ وار دوا کی غلطیاں"),
            data.medication.by_stage,
          )}
          <h2>{t("Timeliness", "بروقت جائزہ")}</h2>
          <p>
            {t("Review target (hours)", "جائزے کا ہدف (گھنٹے)")}:{" "}
            {data.timeliness.review_target_hours};{" "}
            {t("Reviewed in time / reviewed", "بروقت جائزے / کل جائزے")}:{" "}
            {data.timeliness.reviewed_in_time} / {data.timeliness.reviewed};{" "}
            {data.timeliness.reviewed_in_time_pct == null
              ? t(
                  "Percentage unavailable: no reviewed entries",
                  "شرح دستیاب نہیں: کوئی جائزہ نہیں",
                )
              : data.timeliness.reviewed_in_time_pct + "%"}
            ;{" "}
            {t(
              "Analysed by due date / analysed",
              "مقرر تاریخ تک تجزیے / کل تجزیے",
            )}
            : {data.timeliness.analysed_by_due_date} /{" "}
            {data.timeliness.analysed}
          </p>
          <h2>{t("Open now (all periods)", "اب کھلے (تمام مدتیں)")}</h2>
          <p>
            {t(
              "Reported / under review / analysed / sentinel",
              "رپورٹ شدہ / زیر تحقیق / تجزیہ شدہ / سنگین",
            )}
            : {data.open_now.reported} / {data.open_now.under_review} /{" "}
            {data.open_now.analysed} / {data.open_now.sentinel}
          </p>
          <h2>
            {t(
              "Sentinel events and their analyses",
              "سنگین واقعات اور ان کے تجزیے",
            )}
          </h2>
          {!data.sentinel_list.length ? (
            <p>
              {t(
                "No sentinel events in this period.",
                "اس مدت میں کوئی سنگین واقعہ نہیں۔",
              )}
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {[
                      t("Incident", "واقعہ"),
                      t("Type / harm", "قسم / نقصان"),
                      t("Occurred", "وقوع"),
                      t("Status", "حالت"),
                      t("Analysis / signed", "تجزیہ / دستخط"),
                      t("Actions done / total", "اعمال مکمل / کل"),
                    ].map((v) => (
                      <th key={v}>{v}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.sentinel_list.map((r) => (
                    <tr key={r.incident_id}>
                      <td>{r.incident_number}</td>
                      <td>
                        {r.type_name} · {r.harm}
                      </td>
                      <td>{time(r.occurred_at)}</td>
                      <td>{r.status}</td>
                      <td>
                        {r.analysis_method ?? t("Not signed", "دستخط نہیں")} ·{" "}
                        {time(r.analysed_at)}
                      </td>
                      <td>
                        {r.actions_done} / {r.actions}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h2>{t("Reports behind this period", "اس مدت کی اصل رپورٹیں")}</h2>
          <p>
            {t(
              "Includes withdrawn reports; the headline report count excludes them. At 1,000 rows narrow the period.",
              "واپس لی گئی رپورٹیں بھی؛ اوپر کی گنتی انہیں خارج کرتی۔ ہزار صف پر مدت محدود کریں۔",
            )}
          </p>
          {reports.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {[
                      t("Incident", "واقعہ"),
                      t("Type", "قسم"),
                      t("Kind / harm", "واقعہ / نقصان"),
                      t("Occurred", "وقوع"),
                      t("Status", "حالت"),
                    ].map((v) => (
                      <th key={v}>{v}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.incident_id}>
                      <td>{r.incident_number}</td>
                      <td>{r.type_name}</td>
                      <td>
                        {r.kind} · {r.harm}
                      </td>
                      <td>{time(r.occurred_at)}</td>
                      <td>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>
              {t(
                "No reports in the permitted period list.",
                "مجاز مدت کی فہرست میں رپورٹ نہیں۔",
              )}
            </p>
          )}
          <div className="toolbar">
            <button
              data-help="ist.document"
              disabled={!connected || blocked}
              onClick={() => void document(true)}
            >
              {t("Preview safety register PDF", "حفاظت رجسٹر پی ڈی ایف دیکھیں")}
            </button>
            <button
              data-help="ist.document"
              disabled={!connected || blocked}
              onClick={() => void document()}
            >
              {t("Save safety register PDF", "حفاظت رجسٹر پی ڈی ایف محفوظ")}
            </button>
          </div>
          <h2>
            {t(
              "Monthly sentinel event returns",
              "ماہانہ سنگین واقعات کی رپورٹیں",
            )}
          </h2>
          <Field label={t("Ended months to show", "گزرے ماہ دکھائیں")}>
            <select
              data-help="ist.months"
              value={months}
              disabled={blocked || !!month}
              onChange={(e) => setMonths(Number(e.target.value))}
            >
              {[3, 6, 12, 24, 36].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <p>
            {t(
              "A confirmed zero is a nil return. Confirmation freezes the counted entries; later reports remain visible as late entries. Confirm only after checking all reporting sources.",
              "تصدیق شدہ صفر کوئی شکایت نہ ہونے کا اندراج ہے۔ تصدیق گنتی حتمی کرتی؛ بعد کے اندراج الگ نظر آتے۔ تمام ذرائع چیک کرکے تصدیق کریں۔",
            )}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {[
                    t("Month", "ماہ"),
                    t("Entries / late entries", "اندراج / بعد کے اندراج"),
                    t("Confirmation", "تصدیق"),
                    t("Note", "نوٹ"),
                    t("Action", "عمل"),
                  ].map((s) => (
                    <th key={s}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {returns.map((r) => (
                  <tr key={r.month}>
                    <td>{r.month}</td>
                    <td>
                      {r.entries} ·{" "}
                      {r.numbers.join(", ") ||
                        t("No entries", "کوئی اندراج نہیں")}
                      <br />
                      <span
                        className={
                          r.late_entries.length ? "late-entries" : undefined
                        }
                      >
                        {t("Late", "بعد میں")}:{" "}
                        {r.late_entries.join(", ") ||
                          t("None reported", "کوئی رپورٹ نہیں")}
                      </span>
                    </td>
                    <td>
                      {r.confirmed
                        ? (r.confirm_stamp?.text ??
                          r.confirmed_by_name ??
                          t("Not recorded", "درج نہیں"))
                        : t("Not confirmed", "تصدیق نہیں")}
                    </td>
                    <td>{r.note ?? t("Not recorded", "درج نہیں")}</td>
                    <td>
                      {!r.confirmed && canConfirm && (
                        <button
                          data-help="ist.confirm"
                          disabled={!editable || !!month}
                          onClick={() => {
                            setMonth(r);
                            setReviewed(false);
                            write.clearError();
                          }}
                        >
                          {t(
                            "Review month for confirmation",
                            "تصدیق کو ماہ دیکھیں",
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!month && (
        <ClinicalWriteFeedback write={write} onReviewed={() => void load()} />
      )}
      <ErrorBox error={paperError} />
      {notice && <p role="status">{notice}</p>}
      {month && (
        <Modal
          title={t("Confirm sentinel event month", "سنگین واقعات کا ماہ تصدیق")}
          closable={!write.blocked}
          onClose={() => {
            if (write.blocked) return;
            if (
              confirm(
                t(
                  "Discard this unsent confirmation?",
                  "غیر ارسال تصدیق چھوڑیں؟",
                ),
              )
            )
              setMonth(undefined);
          }}
        >
          <button
            type="button"
            data-help="ist.refresh"
            disabled={write.blocked}
            onClick={() => void load()}
          >
            {t("Refresh safety report", "حفاظت رپورٹ تازہ کریں")}
          </button>
          <form onSubmit={confirmReturn}>
            <fieldset disabled={!editable || !canConfirm}>
              <legend>
                {month.month} · {month.entries} {t("entries", "اندراج")}
              </legend>
              <p>
                {month.numbers.join(", ") ||
                  t(
                    "Live count is zero; verify before a nil return.",
                    "موجودہ گنتی صفر؛ خالی رپورٹ سے پہلے تصدیق کریں۔",
                  )}
              </p>
              <Field
                label={t(
                  "How all sources were checked",
                  "تمام ذرائع کیسے چیک کیے",
                )}
              >
                <textarea
                  data-help="ist.note"
                  name="note"
                  maxLength={2000}
                  onChange={() => setReviewed(false)}
                />
              </Field>
              <label>
                <input
                  data-help="ist.review"
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                {t(
                  "I checked this ended month and understand its counted entries will be frozen.",
                  "گزرے ماہ کو چیک کیا اور گنتی حتمی ہونے کو سمجھتا ہوں۔",
                )}
              </label>
              <button data-help="ist.submit" disabled={!reviewed}>
                {t("Confirm this month once", "یہ ماہ ایک بار تصدیق")}
              </button>
            </fieldset>
          </form>
          <ErrorBox error={error} />
          <ClinicalWriteFeedback write={write} onReviewed={() => void load()} />
        </Modal>
      )}
    </section>
  );
}
