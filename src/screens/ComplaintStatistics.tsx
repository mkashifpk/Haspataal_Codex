import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import * as api from "../generated/complaint_statistics";
import { call } from "../bridge";
import { ErrorBox, Field, Modal } from "../components";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";
export function ComplaintStatistics({
  screenId,
  user,
  revision,
  connected,
  readOnly,
  onOpenHelp,
}: {
  screenId: "complaint_statistics" | "complaint_statistics_owner";
  user: ClinicalUser;
  revision: number;
  connected: boolean;
  readOnly: boolean;
  onOpenHelp: () => void;
}) {
  const [data, setData] = useState<api.ComplaintStatisticsOut>(),
    [actions, setActions] = useState<api.QualityActionOut[]>([]),
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
      const [s, a, r] = await Promise.all([
        api.complaintStatistics(query),
        api.listActions({ source: "Complaint", limit: 1000 }),
        api.listReturnsQualityMonthly({ kind: "Complaints", months }),
      ]);
      if (n === generation.current) {
        setData(s);
        setFrom((v) => v || s.date_from);
        setTo((v) => v || s.date_to);
        setActions(a);
        setReturns(r);
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
  });
  const blocked = write.blocked || paperBusy,
    editable = connected && !readOnly && !loading && !error && !blocked,
    canConfirm = user.permissions.includes("complaint.manage");
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
          kind: "Complaints",
          month: selected,
          note: String(f.get("note") ?? "").trim() || null,
        },
        permission: "complaint.manage",
        protection: "idempotent",
        reconcilePath: "/quality/monthly-returns?kind=Complaints&months=36",
        label: t("Confirm this complaint month", "شکایت کا یہ ماہ تصدیق کریں"),
      },
      async () => {
        const current = await api.listReturnsQualityMonthly({
            kind: "Complaints",
            months: 36,
          }),
          row = current.find((r) => r.month === selected);
        if (!row || row.confirmed)
          throw Error(
            t(
              "This month is no longer available to confirm. Refresh the returns and review its stamp.",
              "یہ ماہ اب تصدیق کے لیے دستیاب نہیں۔ فہرست تازہ اور مہر دیکھیں۔",
            ),
          );
      },
    );
  }
  async function document(
    kind: "register" | "policy" | "notice",
    preview = false,
  ) {
    if (!connected || blocked || loading || error || !data) return;
    setPaperBusy(true);
    setPaperError(undefined);
    setNotice("");
    try {
      const r =
        kind === "notice"
          ? await call("print-complaint", { kind: "Notice" })
          : await call("clinical-pdf", {
              path:
                kind === "policy"
                  ? "/complaints/policy/pdf"
                  : `/complaints/register/pdf?date_from=${data.date_from}&date_to=${data.date_to}`,
              preview,
            });
      setNotice(
        kind === "notice"
          ? t(
              "Sent to the document printer. Check the notice.",
              "دستاویز پرنٹر کو بھیجا۔ نوٹس چیک کریں۔",
            )
          : preview
            ? t("Server PDF opened.", "سرور پی ڈی ایف کھلی۔")
            : r.saved
              ? t("Server PDF saved.", "سرور پی ڈی ایف محفوظ۔")
              : t(
                  "Save cancelled; no return was confirmed.",
                  "محفوظ منسوخ؛ ماہ کی تصدیق نہیں ہوئی۔",
                ),
      );
    } catch (e) {
      setPaperError(e);
    } finally {
      setPaperBusy(false);
    }
  }
  function breakdown(title: string, rows: api.ComplaintCountOut[]) {
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
  const percent = (v: number | null) =>
    v === null
      ? t(
          "Not available: no eligible entries",
          "دستیاب نہیں: متعلقہ اندراج نہیں",
        )
      : v + "%";
  return (
    <section
      className="complaint-statistics"
      data-screen={screenId}
      data-unsaved={!!month}
      data-write-pending={write.blocked}
    >
      <div className="section-heading">
        <div>
          <h1>
            {t(
              "Complaint statistics, register and procedure",
              "شکایات کے اعداد، رجسٹر اور طریقہ",
            )}
          </h1>
          <p>
            {t(
              "Review timeliness and recurring concerns, accountable actions and confirmed monthly returns.",
              "بروقت جواب، بار بار خدشات، ذمہ دار اعمال اور تصدیق شدہ ماہ دیکھیں۔",
            )}
          </p>
        </div>
        <div className="toolbar">
          <button
            data-help="cst.refresh"
            disabled={write.busy || paperBusy}
            onClick={() => void load()}
          >
            {t("Refresh complaint report", "شکایت رپورٹ تازہ پڑھیں")}
          </button>
          <button data-help="cst.help" onClick={onOpenHelp}>
            {t("Help / F1", "مدد / ایف ون")}
          </button>
        </div>
      </div>
      {!connected && (
        <p role="alert">
          {t(
            "Disconnected. Reports may be stale; no confirmations are queued offline.",
            "رابطہ نہیں۔ رپورٹ پرانی ہو سکتی؛ آف لائن تصدیق جمع نہیں ہوتی۔",
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
            {t("Complaints received in this period", "اس مدت میں موصول شکایات")}
          </legend>
          <Field label={t("From", "سے")}>
            <input
              data-help="cst.period"
              type="date"
              required
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label={t("To", "تک")}>
            <input
              data-help="cst.period"
              type="date"
              required
              min={from}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <button data-help="cst.apply">
            {t("Apply report period", "رپورٹ کی مدت لگائیں")}
          </button>
        </fieldset>
      </form>
      {loading && (
        <p role="status">
          {t("Reading complaint evidence…", "شکایت کے شواہد پڑھے جا رہے ہیں…")}
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
              [t("Received", "موصول"), data.received],
              [
                t(
                  "Handled (excluding withdrawn / not maintainable)",
                  "زیر کارروائی (واپس یا ناقابل کارروائی خارج)",
                ),
                data.handled,
              ],
              [
                t("Acknowledged in time", "بروقت وصولی جواب"),
                percent(data.acknowledged_in_time_pct),
              ],
              [
                t("Answered in time", "بروقت نتیجہ"),
                percent(data.answered_in_time_pct),
              ],
              [t("Appeals", "اپیلیں"), data.appealed],
              [t("Outcomes upheld", "درست نتائج"), data.by_upheld.filter(r=>r.key==='Upheld').reduce((n,r)=>n+r.count,0)],
              [t("Appeals upheld", "درست اپیلیں"), data.appeals_upheld],
              [t("With actions", "عمل والی شکایات"), data.with_actions],
              [
                t("Safety incidents reported", "حفاظتی واقعات"),
                data.incidents_reported,
              ],
            ].map(([label, value]) => (
              <div key={label} className="metric">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <p>
            {t("Acknowledgement policy hours", "وصولی جواب کی پالیسی گھنٹے")}:{" "}
            {data.acknowledgement_hours} ·{" "}
            {t("Response policy days", "جواب کی پالیسی دن")}:{" "}
            {data.response_days} ·{" "}
            {t("Acknowledged / in time", "وصولی جواب / بروقت")}:{" "}
            {data.acknowledged} / {data.acknowledged_in_time} ·{" "}
            {t(
              "Answered / in time / by date given",
              "نتیجہ / بروقت / دی گئی تاریخ تک",
            )}
            : {data.answered} / {data.answered_in_time} /{" "}
            {data.answered_by_date_given} · {t("Extended", "مزید وقت")}:{" "}
            {data.extended} ·{" "}
            {t("Withdrawn / not maintainable", "واپس / ناقابل کارروائی")}:{" "}
            {data.withdrawn} / {data.not_maintainable}
          </p>
          <h2>
            {t(
              "Open now — independent of the report period",
              "اب کھلی — رپورٹ کی مدت سے الگ",
            )}
          </h2>
          <p>
            {t(
              "Received / investigating / appeal window / appealed / overdue",
              "موصول / تحقیق / اپیل کی مدت / اپیل / تاخیر",
            )}
            : {data.open_now.received} / {data.open_now.investigating} /{" "}
            {data.open_now.awaiting_appeal_window} / {data.open_now.appealed} /{" "}
            {data.open_now.overdue}
          </p>
          <div className="form-grid">
            {breakdown(t("By category", "زمرے کے لحاظ سے"), data.by_category)}
            {breakdown(t("By channel", "ذریعے کے لحاظ سے"), data.by_channel)}
            {breakdown(
              t("By department", "شعبے کے لحاظ سے"),
              data.by_department,
            )}
            {breakdown(t("By priority", "ترجیح کے لحاظ سے"), data.by_priority)}
            {breakdown(t("Outcome upheld", "نتیجہ درست"), data.by_upheld)}
            {breakdown(t("Satisfaction", "اطمینان"), data.by_satisfaction)}
            {breakdown(
              t("Received by month", "ماہ وار موصول"),
              data.by_month.map((r) => ({ key: r.month, count: r.received })),
            )}
            {breakdown(
              t("Upheld by month", "ماہ وار درست"),
              data.by_month.map((r) => ({ key: r.month, count: r.upheld })),
            )}
          </div>
          <h2>
            {t(
              "Actions alongside recurring categories",
              "بار بار زمروں کے ساتھ اعمال",
            )}
          </h2>
          <p>
            {t(
              "Complaint actions are the current register, across periods; they are not attributed to a category without a server link.",
              "شکایت کے اعمال موجودہ رجسٹر، تمام مدتوں کے ہیں؛ سرور رابطے کے بغیر زمرے سے منسوب نہیں۔",
            )}{" "}
            {t(
              "Period action summary: open / done",
              "مدت کے اعمال: کھلے / مکمل",
            )}
            : {data.actions.open} / {data.actions.done}
          </p>
          {!user.permissions.some((p) =>
            ["quality.action.view", "quality.action.manage"].includes(p),
          ) && (
            <p>
              {t(
                "Your action list contains only your own assignments.",
                "اعمال کی فہرست میں صرف آپ کی ذمہ داریاں ہیں۔",
              )}
            </p>
          )}
          {actions.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                  {[
                    t("Action","عمل"),
                    t("Complaint","شکایت"),
                    t("Description","تفصیل"),
                    t("Owner","ذمہ دار"),
                    t("Due","تاریخ"),
                    t("Status","حالت"),
                    t("Evidence","ثبوت"),
                  ].map((v) => (
                      <th key={v}>{v}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {actions.map((a) => (
                    <tr key={a.action_id}>
                      <td>{a.action_number}</td>
                      <td>
                        {a.complaint_number ?? t("Not recorded", "درج نہیں")}
                      </td>
                      <td>{a.description}</td>
                      <td>{a.owner_name}</td>
                      <td>{a.due_date}</td>
                      <td>
                        {a.status}
                        {a.is_overdue ? " · " + t("Overdue", "تاخیر") : ""}
                      </td>
                      <td>{a.outcome_note ?? t("Not recorded", "درج نہیں")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>
              {t(
                "No complaint actions in your permitted list.",
                "آپ کی مجاز فہرست میں شکایت کے اعمال نہیں۔",
              )}
            </p>
          )}
          <div className="toolbar">
            {(["register", "policy"] as const).map((kind) => (
              <span key={kind}>
                <button
                  data-help="cst.document"
                  disabled={!connected || blocked}
                  onClick={() => void document(kind, true)}
                >
                  {kind === "register"
                    ? t(
                        "Preview period register PDF",
                        "مدت کا رجسٹر پی ڈی ایف دیکھیں",
                      )
                    : t("Preview procedure PDF", "طریقہ پی ڈی ایف دیکھیں")}
                </button>
                <button
                  data-help="cst.document"
                  disabled={!connected || blocked}
                  onClick={() => void document(kind)}
                >
                  {kind === "register"
                    ? t(
                        "Save period register PDF",
                        "مدت کا رجسٹر پی ڈی ایف محفوظ",
                      )
                    : t("Save procedure PDF", "طریقہ پی ڈی ایف محفوظ")}
                </button>
              </span>
            ))}
            <button
              data-help="cst.notice"
              disabled={!connected || blocked}
              onClick={() => void document("notice")}
            >
              {t("Print waiting-area notice", "انتظار گاہ کا نوٹس پرنٹ")}
            </button>
          </div>
          <h2>{t("Monthly complaint returns", "ماہانہ شکایت رپورٹیں")}</h2>
          <Field label={t("Ended months to show", "گزرے ماہ دکھائیں")}>
            <select
              data-help="cst.months"
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
                      {t("Late", "بعد میں")}:{" "}
                      {r.late_entries.join(", ") ||
                        t("None reported", "کوئی رپورٹ نہیں")}
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
                          data-help="cst.confirm"
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
      {!month && <ClinicalWriteFeedback write={write} onReviewed={() => void load()} />}
      <ErrorBox error={paperError} />
      {notice && <p role="status">{notice}</p>}
      {month && (
        <Modal
          title={t("Confirm complaint month", "شکایت کا ماہ تصدیق")}
          closable={!write.blocked}
          onClose={() => {
            if(write.blocked) return;
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
                <textarea data-help="cst.note" name="note" maxLength={2000} />
              </Field>
              <label>
                <input
                  data-help="cst.review"
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                {t(
                  "I checked this ended month and understand its counted entries will be frozen.",
                  "گزرے ماہ کو چیک کیا اور گنتی حتمی ہونے کو سمجھتا ہوں۔",
                )}
              </label>
              <button data-help="cst.submit" disabled={!reviewed}>
                {t("Confirm this month once", "یہ ماہ ایک بار تصدیق")}
              </button>
            </fieldset>
          </form>
          <ErrorBox error={error}/>
          <ClinicalWriteFeedback write={write} onReviewed={() => void load()}/>
        </Modal>
      )}
    </section>
  );
}
