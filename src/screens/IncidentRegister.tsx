import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import * as api from "../generated/incident_register";
import { DirectoryPicker } from "../DirectoryPicker";
import { ErrorBox, Field } from "../components";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";
import { MyInvestigations } from "./MyInvestigations";
import {formatHospitalTime} from '../hospital-time';
type Mode = "review" | "withdraw" | "close";
const statusText = (s: string) =>
  ({
    Reported: t("Reported", "رپورٹ شدہ"),
    UnderReview: t("Under review", "زیر تحقیق"),
    Analysed: t("Analysis signed", "تجزیہ دستخط شدہ"),
    Closed: t("Closed", "بند"),
    Withdrawn: t("Withdrawn", "واپس لیا"),
  })[s] ?? s;
export function IncidentRegister({
  user,
  revision,
  connected,
  readOnly,
  timeZone,
  onOpenHelp,
}: {
  user: ClinicalUser;
  revision: number;
  connected: boolean;
  readOnly: boolean;
  timeZone?: string;
  onOpenHelp: () => void;
}) {
  const [rows, setRows] = useState<api.IncidentOut[]>([]),
    [detail, setDetail] = useState<api.IncidentDetailOut>(),
    [types, setTypes] = useState<api.IncidentTypeOut[]>([]),
    [actions, setActions] = useState<api.QualityActionOut[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<unknown>(),
    [mode, setMode] = useState<Mode>(),
    [reviewed, setReviewed] = useState(false),
    [followupBusy, setFollowupBusy] = useState(false),
    [localRevision, setLocalRevision] = useState(0),
    [query, setQuery] = useState<Parameters<typeof api.listIncidents>[0]>({
      limit: 1000,
    }),
    [typeCode, setTypeCode] = useState(""),
    [dateFrom, setDateFrom] = useState(''),
    [dateTo, setDateTo] = useState(''),
    [kind, setKind] = useState(""),
    [harm, setHarm] = useState(""),
    [override, setOverride] = useState("list"),
    [investigator, setInvestigator] = useState("");
  const selected = useRef<number | undefined>(undefined),
    generation = useRef(0);
  const when=(v:string|null)=>v?(timeZone?formatHospitalTime(v,timeZone):v):t('Not recorded','درج نہیں');
  const load = useCallback(async () => {
    const n = ++generation.current;
    setLoading(true);
    setError(undefined);
    setReviewed(false);
    try {
      const [list, record, ts, as] = await Promise.all([
        api.listIncidents(query),
        selected.current ? api.getIncident(selected.current) : undefined,
        api.listTypes({ active_only: true }),
        api.listActions({ source: "Incident", status: "Open", limit: 1000 }),
      ]);
      if (n === generation.current) {
        const rank = (r: api.IncidentOut) =>
          r.status === "Reported"
            ? 0
            : r.status === "UnderReview"
              ? 1
              : r.status === "Analysed" &&
                  as.some((a) => a.incident_id === r.incident_id)
                ? 2
                : r.status === "Analysed"
                  ? 3
                  : 4;
        setRows(
          list.sort(
            (a, b) =>
              rank(a) - rank(b) ||
              (a.analysis_due ?? a.reported_at).localeCompare(
                b.analysis_due ?? b.reported_at,
              ),
          ),
        );
        setDetail(record);
        setTypes(ts);
        setActions(as);
      }
    } catch (e) {
      if (n === generation.current) setError(e);
    } finally {
      if (n === generation.current) setLoading(false);
    }
  }, [query]);
  useEffect(() => {
    void load();
    return () => {
      ++generation.current;
    };
  }, [load, revision]);
  const changed = useCallback(() => {
    void load();
    setLocalRevision((v) => v + 1);
  }, [load]);
  const write = useClinicalWrite(user, "incident_register", async () => {
      setMode(undefined);
      setReviewed(false);
      changed();
    }),
    blocked = write.blocked || followupBusy,
    editable = connected && !readOnly && !loading && !error && !blocked;
  useEffect(() => {
    if (write.error && !write.blocked) changed();
  }, [write.error, write.blocked, changed]);
  const can = (m: Mode) =>
    !!detail &&
    editable &&
    user.permissions.includes("incident.manage") &&
    (m === "review"
      ? detail.can_review
      : m === "withdraw"
        ? detail.can_withdraw
        : detail.can_close);
  function begin(m: Mode) {
    if (!can(m) || !detail) return;
    setTypeCode(
      types.some((r) => r.type_code === detail.type_code)
        ? detail.type_code
        : "",
    );
    setKind(detail.kind);
    setHarm(detail.harm);
    setOverride("list");
    setInvestigator("");
    setReviewed(false);
    write.clearError();
    setMode(m);
  }
  const type = types.find((r) => r.type_code === typeCode),
    derived = type?.sentinel === "Always" || ["Severe", "Death"].includes(harm),
    overridden = override !== "list" && (override === "yes") !== derived;
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!mode || !detail || !reviewed || !can(mode)) return;
    const f = new FormData(e.currentTarget),
      s = (k: string) => String(f.get(k) ?? "").trim(),
      body: api.IncidentReviewIn | api.WithdrawIn | api.IncidentCloseIn =
        mode === "review"
          ? {
              type_code: typeCode,
              kind: kind as api.IncidentReviewIn["kind"],
              harm: harm as api.IncidentReviewIn["harm"],
              investigator_user_id: Number(investigator),
              analysis_due: s("analysis_due") || null,
              is_sentinel: override === "list" ? null : override === "yes",
              sentinel_reason: overridden ? s("sentinel_reason") : null,
              note: s("note") || null,
              expected_version: detail.row_version,
            }
          : mode === "withdraw"
            ? { reason: s("reason"), expected_version: detail.row_version }
            : {
                closure_note: s("closure_note"),
                expected_version: detail.row_version,
              };
    if (mode === "review" && (!typeCode || !investigator)) return;
    write.start({
      method: "POST",
      path: `/incidents/${detail.incident_id}/${mode}`,
      body,
      permission: {
        recordPath: `/incidents/${detail.incident_id}`,
        capability:
          mode === "review"
            ? "can_review"
            : mode === "withdraw"
              ? "can_withdraw"
              : "can_close",
      },
      protection: "reconcile",
      reconcilePath: `/incidents/${detail.incident_id}`,
      label:
        mode === "review"
          ? t("Review and assign investigator", "جائزہ و تحقیق کار مقرر")
          : mode === "withdraw"
            ? t("Withdraw this report", "یہ رپورٹ واپس لیں")
            : t("Close with follow-up", "اگلے اقدام کے ساتھ بند"),
    });
  }
  return (
    <section
      data-screen="incident_register"
      data-unsaved={!!mode || followupBusy}
      data-write-pending={write.blocked}
    >
      <div className="section-heading">
        <div>
          <h1>{t("Incident register", "واقعات کا رجسٹر")}</h1>
          <p>
            {t(
              "Review the report, assign independent investigation and follow the analysis/actions to a documented closure.",
              "رپورٹ کا جائزہ، آزاد تحقیق، تجزیہ و اعمال اور ثبوت سے بندش تک عمل دیکھیں۔",
            )}
          </p>
        </div>
        <div className="toolbar">
          <button
            data-help="irg.refresh"
            disabled={write.busy}
            onClick={changed}
          >
            {t("Refresh incident register", "واقعات کا رجسٹر تازہ پڑھیں")}
          </button>
          <button data-help="irg.help" onClick={onOpenHelp}>
            {t("Help / F1", "مدد / ایف ون")}
          </button>
        </div>
      </div>
      {!connected && (
        <p role="alert">
          {t(
            "Disconnected. Preserve the draft; no offline business writes are queued.",
            "رابطہ نہیں۔ مسودہ رکھیں؛ آف لائن اندراج جمع نہیں ہوتا۔",
          )}
        </p>
      )}
      {readOnly && (
        <p>
          {t(
            "Records only. Review, withdrawal and closure are unavailable in this service view.",
            "صرف ریکارڈ۔ اس خدمت میں جائزہ، واپسی یا بندش نہیں۔",
          )}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (blocked || mode) return;
          const f = new FormData(e.currentTarget);
          setQuery({
            limit: 1000,
            status: (String(f.get("status") || "") || undefined) as NonNullable<
              Parameters<typeof api.listIncidents>[0]
            >["status"],
            sentinel_only: f.get("sentinel") === "on",
            date_from: String(f.get("date_from") || "") || undefined,
            date_to: String(f.get("date_to") || "") || undefined,
          });
        }}
      >
        <fieldset disabled={blocked || !!mode}>
          <legend>{t("Register filters", "رجسٹر کے فلٹر")}</legend>
          <Field label={t("Status", "حالت")}>
            <select data-help="irg.filters" name="status" defaultValue="">
              <option value="">{t("All statuses", "تمام حالتیں")}</option>
              {[
                "Reported",
                "UnderReview",
                "Analysed",
                "Closed",
                "Withdrawn",
              ].map((s) => (
                <option key={s} value={s}>
                  {statusText(s)}
                </option>
              ))}
            </select>
          </Field>
          <label>
            <input data-help="irg.filters" type="checkbox" name="sentinel" />
            {t("Sentinel events only", "صرف سنگین واقعات")}
          </label>
          <Field label={t("Occurred from", "واقعہ سے")}>
            <input data-help="irg.filters" name="date_from" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
          </Field>
          <Field label={t("Occurred to", "واقعہ تک")}>
            <input data-help="irg.filters" name="date_to" type="date" value={dateTo} min={dateFrom||undefined} onChange={e=>setDateTo(e.target.value)} />
          </Field>
          <button data-help="irg.filters">
            {t("Apply filters", "فلٹر لگائیں")}
          </button>
        </fieldset>
      </form>
      {loading && (
        <p role="status">
          {t(
            "Reading current incident register…",
            "موجودہ واقعات رجسٹر پڑھا جا رہا ہے…",
          )}
        </p>
      )}
      <ErrorBox error={error} />
      {!loading &&
        !error &&
        (rows.length ? (
          <>
            <p>
              {rows.length} {t("reports", "رپورٹیں")}
              {rows.length === 1000
                ? " · " +
                  t(
                    "Limit reached; narrow the dates/status.",
                    "حد پوری؛ مدت یا حالت محدود کریں۔",
                  )
                : ""}
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {[
                      t("Report", "رپورٹ"),
                      t("Patient / location", "مریض / جگہ"),
                      t("Status / due", "حالت / تاریخ"),
                      t("Visible open actions", "نظر آنے والے کھلے اعمال"),
                      t("Open", "کھولیں"),
                    ].map((s) => (
                      <th key={s}>{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.incident_id}>
                      <td>
                        {r.incident_number} · {r.type_name}
                        {r.is_sentinel && (
                          <strong className="field-error">
                            {" "}
                            · {t("Sentinel", "سنگین واقعہ")}
                          </strong>
                        )}
                      </td>
                      <td>
                        {[
                          r.patient_name,
                          r.mrn,
                          r.department_name,
                          r.ward_name,
                          r.location,
                        ]
                          .filter((v) => v !== null)
                          .join(" · ") || t("Not recorded", "درج نہیں")}
                      </td>
                      <td>
                        {statusText(r.status)} ·{" "}
                        {r.analysis_due ?? t("Not assigned", "مقرر نہیں")}
                        {(r.review_overdue || r.analysis_overdue) && (
                          <strong className="field-error">
                            {" "}
                            ·{" "}
                            {r.review_overdue
                              ? t("Review overdue", "جائزہ تاخیر")
                              : t("Analysis overdue", "تجزیہ تاخیر")}
                          </strong>
                        )}
                      </td>
                      <td>
                        {
                          actions.filter((a) => a.incident_id === r.incident_id)
                            .length
                        }
                      </td>
                      <td>
                        <button
                          data-help="irg.open"
                          disabled={blocked || !!mode}
                          onClick={() => {
                            selected.current = r.incident_id;
                            changed();
                          }}
                        >
                          {t("Open incident", "واقعہ کھولیں")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p>
            {t(
              "No incidents match this period/status. Clear filters or refresh; do not invent a report.",
              "مدت یا حالت میں واقعہ نہیں۔ فلٹر صاف یا تازہ پڑھیں؛ رپورٹ نہ گھڑیں۔",
            )}
          </p>
        ))}
      {detail && (
        <article key={detail.incident_id} hidden={loading || !!error}>
          <h2>
            {detail.incident_number} · {detail.type_name}
          </h2>
          <p>
            {statusText(detail.status)} ·{" "}
            {detail.next_step ?? t("No further step", "اگلا قدم نہیں")}
          </p>
          <p>
            {t("Reporter", "رپورٹ کرنے والا")}: {detail.reported_by_name} ·{" "}
            {detail.report_stamp?.text ??
              t("No stamp recorded", "مہر درج نہیں")}
          </p>
          <p>
            {t("Reviewed by", "جائزہ کرنے والا")}:{" "}
            {detail.reviewed_by_name ?? t("Not recorded", "درج نہیں")} ·{" "}
            {when(detail.reviewed_at)}
          </p>
          <p>
            {detail.review_note ??
              t("No review note recorded", "جائزے کا نوٹ نہیں")}
          </p>
          <p>
            {detail.sentinel_override ??
              t(
                "No sentinel override recorded",
                "سنگین درجہ بندی کی تبدیلی نہیں",
              )}
          </p>
          {detail.withdraw_reason && (
            <p>
              {t("Withdrawal reason", "واپسی کی وجہ")}: {detail.withdraw_reason}
            </p>
          )}
          {detail.closed_at && <div><h3>{t('Closure and follow-up','بندش اور اگلا اقدام')}</h3><p className="preserve-whitespace">{detail.closure_note??t('Not recorded','درج نہیں')}</p><p>{detail.closure_stamp?.text??t('No stamp recorded','مہر درج نہیں')} · {when(detail.closed_at)}</p></div>}
          <div className="toolbar">
            {(["review", "withdraw", "close"] as Mode[])
              .filter((m) =>
                m === "review"
                  ? detail.can_review
                  : m === "withdraw"
                    ? detail.can_withdraw
                    : detail.can_close,
              )
              .map((m) => (
                <button
                  key={m}
                  data-help={m==='review'?'irg.review':m==='withdraw'?'irg.withdraw':'irg.close'}
                  disabled={!can(m) || !!mode}
                  onClick={() => begin(m)}
                >
                  {m === "review"
                    ? t("Review and assign", "جائزہ و ذمہ داری")
                    : m === "withdraw"
                      ? t("Withdraw report", "رپورٹ واپس لیں")
                      : t("Close incident", "واقعہ بند کریں")}
                </button>
              ))}
          </div>
          {mode && (
            <form key={mode} onSubmit={submit}>
              <fieldset disabled={!can(mode)}>
                <legend>
                  {mode === "review"
                    ? t(
                        "Confirm classification and investigator",
                        "درجہ بندی و تحقیق کار مقرر",
                      )
                    : mode === "withdraw"
                      ? t(
                          "Withdraw without erasing history",
                          "تاریخ رکھ کر واپس لیں",
                        )
                      : t(
                          "Close with documented follow-up",
                          "ثبوت والے اگلے اقدام سے بند",
                        )}
                </legend>
                {mode === "review" ? (
                  <>
                    <Field label={t("Confirmed type", "تصدیق شدہ قسم")}>
                      <select
                        data-help="irg.type"
                        value={typeCode}
                        onChange={(e) => {
                          setTypeCode(e.target.value);
                          setReviewed(false);
                        }}
                        required
                      >
                        <option value="">
                          {t(
                            "Choose an active reporting type",
                            "فعال رپورٹ کی قسم چنیں",
                          )}
                        </option>
                        {types.map((r) => (
                          <option key={r.type_code} value={r.type_code}>
                            {r.name} · {r.area}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t("Kind", "نوعیت")}>
                      <select
                        data-help="irg.kind"
                        value={kind}
                        onChange={(e) => {
                          setKind(e.target.value);
                          setReviewed(false);
                        }}
                        required
                      >
                        <option value="Incident">
                          {t("Incident", "واقعہ")}
                        </option>
                        <option value="NearMiss">
                          {t("Near miss", "نقصان سے بال بال بچاؤ")}
                        </option>
                      </select>
                    </Field>
                    <Field label={t("Harm", "نقصان")}>
                      <select
                        data-help="irg.harm"
                        value={harm}
                        onChange={(e) => {
                          setHarm(e.target.value);
                          setReviewed(false);
                        }}
                        required
                      >
                        {[
                          ["NoHarm", "No harm", "نقصان نہیں"],
                          ["Mild", "Mild", "ہلکا"],
                          ["Moderate", "Moderate", "درمیانہ"],
                          ["Severe", "Severe", "شدید"],
                          ["Death", "Death", "موت"],
                        ].map(([v, en, ur]) => (
                          <option key={v} value={v}>
                            {t(en, ur)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <p>
                      {t(
                        "Class from selected list/type and harm",
                        "منتخب قسم اور نقصان سے درجہ",
                      )}
                      :{" "}
                      {derived
                        ? t("Sentinel event", "سنگین واقعہ")
                        : t("Not sentinel", "سنگین نہیں")}
                    </p>
                    <Field
                      label={t("Classification decision", "درجہ بندی کا فیصلہ")}
                    >
                      <select
                        data-help="irg.sentinel"
                        value={override}
                        onChange={(e) => {
                          setOverride(e.target.value);
                          setReviewed(false);
                        }}
                      >
                        <option value="list">
                          {t("Follow the list", "فہرست کے مطابق")}
                        </option>
                        <option value="yes">
                          {t("Sentinel", "سنگین واقعہ")}
                        </option>
                        <option value="no">
                          {t("Not sentinel", "سنگین نہیں")}
                        </option>
                      </select>
                    </Field>
                    {overridden && (
                      <Field
                        label={t(
                          "Why classification differs from the list",
                          "فہرست سے الگ درجے کی وجہ",
                        )}
                      >
                        <textarea
                          data-help="irg.sentinel-reason"
                          name="sentinel_reason"
                          required
                          maxLength={1000}
                        />
                      </Field>
                    )}
                    <Field
                      label={t("Independent investigator", "آزاد تحقیق کار")}
                    >
                      <DirectoryPicker
                        data-help="irg.investigator"
                        path="/quality/record-review/people"
                        idField="user_id"
                        value={investigator}
                        onChange={(e) => {
                          setInvestigator(e.target.value);
                          setReviewed(false);
                        }}
                      />
                    </Field>
                    <Field
                      label={t(
                        "Analysis due (blank uses server policy)",
                        "تجزیے کی تاریخ (خالی پر سرور پالیسی)",
                      )}
                    >
                      <input
                        data-help="irg.due"
                        name="analysis_due"
                        type="date"
                      />
                    </Field>
                    <Field label={t("Review note", "جائزے کا نوٹ")}>
                      <textarea
                        data-help="irg.note"
                        name="note"
                        maxLength={2000}
                      />
                    </Field>
                  </>
                ) : mode === "withdraw" ? (
                  <Field
                    label={t("Actual reason to withdraw", "واپسی کی اصل وجہ")}
                  >
                    <textarea
                      data-help="irg.reason"
                      name="reason"
                      required
                      minLength={5}
                      maxLength={1000}
                    />
                  </Field>
                ) : (
                  <Field
                    label={t("Follow-up: what changed", "اگلا اقدام: کیا بدلا")}
                  >
                    <textarea
                      data-help="irg.closure"
                      name="closure_note"
                      required
                      minLength={5}
                      maxLength={4000}
                    />
                  </Field>
                )}
                <label>
                  <input
                    data-help="irg.confirm"
                    type="checkbox"
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                  />
                  {t(
                    "I reviewed the current report and the effect of this action.",
                    "موجودہ رپورٹ اور اس عمل کا اثر چیک کیا ہے۔",
                  )}
                </label>
                <button
                  data-help="irg.submit"
                  disabled={!reviewed || (mode === "review" && !investigator)}
                >
                  {t(
                    "Record this versioned action",
                    "نسخے کے ساتھ یہ عمل درج کریں",
                  )}
                </button>
              </fieldset>
              <button
                data-help="irg.cancel"
                type="button"
                disabled={write.blocked}
                onClick={() => {
                  if (
                    confirm(
                      t(
                        "Discard this unsent decision?",
                        "غیر ارسال فیصلہ چھوڑیں؟",
                      ),
                    )
                  )
                    setMode(undefined);
                }}
              >
                {t("Cancel unsent decision", "غیر ارسال فیصلہ منسوخ")}
              </button>
            </form>
          )}
          {!mode && (
            <MyInvestigations
              key={detail.incident_id}
              user={user}
              revision={revision + localRevision}
              connected={connected}
              readOnly={readOnly}
              timeZone={timeZone}
              recordId={detail.incident_id}
              parentScreen="incident_register"
              onEditingChange={setFollowupBusy}
              onChanged={changed}
              onOpenHelp={onOpenHelp}
            />
          )}
        </article>
      )}
      <ClinicalWriteFeedback
        write={write}
        onReviewed={() => {
          changed();
        }}
      />
    </section>
  );
}
