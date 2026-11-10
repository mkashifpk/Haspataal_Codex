import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import * as api from "../generated/action_register";
import { call } from "../bridge";
import { ErrorBox, Field } from "../components";
import { DirectoryPicker } from "../DirectoryPicker";
import { ClinicalWriteFeedback, useClinicalWrite } from "../clinical-write";
import type { ClinicalUser } from "../clinical-context";
import { bilingual as t } from "../i18n";
import { formatHospitalTime } from "../hospital-time";
import { ActionSourcePreview } from "./ActionSourcePreview";
type Source = api.QualityActionOut["source"];
const sources: Source[] = [
  "RecordReview",
  "Incident",
  "Complaint",
  "InfectionAudit",
  "Meeting",
  "Drill",
  "MockInterview",
  "QaRound",
  "PatientFeedback",
];
const sourceName = (s: Source) =>
  ({
    RecordReview: t("Record review", "ریکارڈ جائزہ"),
    Incident: t("Incident", "واقعہ"),
    Complaint: t("Complaint", "شکایت"),
    InfectionAudit: t("Infection audit", "انفیکشن آڈٹ"),
    Meeting: t("Committee meeting", "کمیٹی اجلاس"),
    Drill: t("Drill", "مشق"),
    MockInterview: t("Mock interview", "فرضی انٹرویو"),
    QaRound: t("QA round", "معیار کا دورہ"),
    PatientFeedback: t("Patient feedback", "مریض کی رائے"),
  })[s];
const statusName = (s: api.QualityActionOut["status"]) =>
  ({
    Open: t("Open", "کھلا"),
    Done: t("Done", "مکمل"),
    Cancelled: t("Cancelled", "منسوخ"),
  })[s];
export function ActionRegister({
  initialSource,
  user,
  revision,
  connected,
  readOnly,
  timeZone,
  onOpenHelp,
}: {
  initialSource?: Source;
  user: ClinicalUser;
  revision: number;
  connected: boolean;
  readOnly: boolean;
  timeZone?: string;
  onOpenHelp: () => void;
}) {
  const [rows, setRows] = useState<api.QualityActionOut[]>([]),
    [detail, setDetail] = useState<api.QualityActionOut>(),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<unknown>(),
    [query, setQuery] = useState<Parameters<typeof api.listActions>[0]>({
      limit: 1000,
      source: initialSource,
    }),
    [source, setSource] = useState<Source | "">(initialSource ?? ""),
    [statusFilter, setStatusFilter] = useState<
      api.QualityActionOut["status"] | ""
    >(""),
    [overdue, setOverdue] = useState(false),
    [department, setDepartment] = useState(""),
    [editing, setEditing] = useState(false),
    [status, setStatus] = useState<api.ActionDoneIn["status"] | "">(""),
    [note, setNote] = useState(""),
    [version, setVersion] = useState<number>(),
    [reviewed, setReviewed] = useState(false),
    [sourceRecord, setSourceRecord] = useState<api.QualityActionOut>(),
    [paperBusy, setPaperBusy] = useState(false),
    [paperError, setPaperError] = useState<unknown>(),
    [paperNotice, setPaperNotice] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const generation = useRef(0),
    selected = useRef<number | undefined>(undefined);
  const load = useCallback(async () => {
    const n = ++generation.current;
    setLoading(true);
    setError(undefined);
    setReviewed(false);
    try {
      const [list, current] = await Promise.all([
        api.listActions(query),
        selected.current ? api.getAction(selected.current) : undefined,
      ]);
      if (n === generation.current) {
        setRows(list);
        setDetail(current);
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
  useEffect(() => {
    setSourceRecord(undefined);
  }, [user.user_id, user.permissions.join("|")]);
  const write = useClinicalWrite(user, "action_register", async () => {
    setEditing(false);
    setNote("");
    setReviewed(false);
    await load();
  });
  useEffect(() => {
    if (write.error && !write.blocked) void load();
  }, [write.error, write.blocked, load]);
  const blocked = write.blocked || paperBusy,
    canManage = user.permissions.includes("quality.action.manage"),
    editable =
      connected &&
      !readOnly &&
      !loading &&
      !error &&
      !blocked &&
      detail?.status === "Open" &&
      (canManage || detail?.owner_user_id === user.user_id),
    stale = editing && detail?.row_version !== version;
  const time = (v: string | null) =>
    v == null
      ? t("Not recorded", "درج نہیں")
      : timeZone
        ? formatHospitalTime(v, timeZone)
        : v;
  function open(id: number) {
    if (blocked) return;
    if (
      editing &&
      !window.confirm(
        t(
          "Discard this unsent action decision?",
          "غیر ارسال عمل کا فیصلہ چھوڑ دیں؟",
        ),
      )
    )
      return;
    write.clearError();
    selected.current = id;
    setEditing(false);
    setReviewed(false);
    setNote("");
    void load();
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (
      !detail ||
      !editable ||
      stale ||
      !reviewed ||
      !status ||
      version == null
    )
      return;
    const base = "/quality/actions/" + detail.action_id;
    write.start({
      method: "POST",
      path: base + "/complete",
      body: {
        status,
        note: note.trim(),
        expected_version: version,
      } satisfies api.ActionDoneIn,
      permission: canManage
        ? "quality.action.manage"
        : { recordPath: base, ownerField: "owner_user_id" },
      protection: "reconcile",
      reconcilePath: base,
      label:
        status === "Done"
          ? t("Complete with evidence", "ثبوت کے ساتھ مکمل کریں")
          : t("Cancel with reason", "وجہ کے ساتھ منسوخ کریں"),
    });
  }
  async function paper(preview: boolean) {
    if (!connected || blocked || !from || !to || from > to) return;
    setPaperBusy(true);
    setPaperError(undefined);
    setPaperNotice("");
    try {
      const r = await call("clinical-pdf", {
        path:
          "/quality/actions/register/pdf?date_from=" +
          from +
          "&date_to=" +
          to +
          (query?.source ? "&source=" + query.source : ""),
        preview,
      });
      setPaperNotice(
        preview
          ? t("Action register PDF opened.", "اعمال رجسٹر پی ڈی ایف کھلی۔")
          : r.saved
            ? t("Action register PDF saved.", "اعمال رجسٹر پی ڈی ایف محفوظ۔")
            : t(
                "PDF save cancelled; no action changed.",
                "پی ڈی ایف محفوظ منسوخ؛ عمل نہیں بدلا۔",
              ),
      );
    } catch (e) {
      setPaperError(e);
    } finally {
      setPaperBusy(false);
    }
  }
  return (
    <section
      data-screen="action_register"
      data-unsaved={editing}
      data-write-pending={write.blocked}
    >
      <div className="section-heading">
        <div>
          <h1>
            {t(
              "Corrective and preventive action register",
              "اصلاحی اور احتیاطی اعمال کا رجسٹر",
            )}
          </h1>
          <p>
            {t(
              "For Quality follow-up: who owns the work, when it is due, and the evidence of completion.",
              "کوالٹی پیروی کے لیے: کام کس کے ذمے، آخری تاریخ اور تکمیل کا ثبوت۔",
            )}
          </p>
        </div>
        <div className="toolbar">
          <button
            data-help="acr.refresh"
            disabled={write.busy || paperBusy}
            onClick={() => void load()}
          >
            {t("Refresh action register", "عمل رجسٹر تازہ کریں")}
          </button>
          <button data-help="acr.help" onClick={onOpenHelp}>
            {t("Help / F1", "مدد / ایف ون")}
          </button>
        </div>
      </div>
      {!connected && (
        <p role="status">
          {t(
            "Reconnecting. Decisions are unavailable; no work is queued offline.",
            "رابطہ بحال ہو رہا ہے۔ فیصلے دستیاب نہیں؛ آف لائن کام جمع نہیں۔",
          )}
        </p>
      )}
      <ClinicalWriteFeedback
        write={write}
        onReviewed={() => {
          write.clearError();
          setEditing(false);
          setReviewed(false);
          void load();
        }}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (blocked || editing) return;
          setQuery({
            source: source || undefined,
            status: statusFilter || undefined,
            overdue_only: overdue,
            department_id: department ? Number(department) : undefined,
            limit: 1000,
          });
        }}
      >
        <fieldset disabled={blocked || editing}>
          <legend>{t("Filter actions", "اعمال چھانٹیں")}</legend>
          <div className="form-grid">
            <Field label={t("Source", "ماخذ")}>
              <select
                data-help="acr.filters"
                value={source}
                onChange={(e) => setSource(e.target.value as Source | "")}
              >
                <option value="">{t("All sources", "تمام ماخذ")}</option>
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {sourceName(s)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Status", "حالت")}>
              <select
                data-help="acr.filters"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as typeof statusFilter)
                }
              >
                <option value="">{t("All statuses", "تمام حالتیں")}</option>
                {(["Open", "Done", "Cancelled"] as const).map((s) => (
                  <option key={s} value={s}>
                    {statusName(s)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Department", "شعبہ")}>
              <DirectoryPicker
                data-help="acr.department"
                path="/admin/departments"
                idField="department_id"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </Field>
          </div>
          <label>
            <input
              data-help="acr.filters"
              type="checkbox"
              checked={overdue}
              onChange={(e) => setOverdue(e.target.checked)}
            />
            {t("Overdue only", "صرف تاخیر والے")}
          </label>
          <button data-help="acr.apply">
            {t("Apply action filters", "اعمال کے فلٹر لگائیں")}
          </button>
        </fieldset>
      </form>
      <ErrorBox error={error} />
      {loading && (
        <p role="status">
          {t("Reading current actions…", "موجودہ اعمال پڑھے جا رہے ہیں…")}
        </p>
      )}
      {!loading && !error && (
        <>
          {rows.length === 1000 && (
            <p role="alert">
              {t(
                "Showing up to 1,000 actions. Narrow source, status or department to reconcile further work.",
                "ہزار تک اعمال۔ مزید کام کو ماخذ، حالت یا شعبہ سے محدود کریں۔",
              )}
            </p>
          )}
          {!rows.length ? (
            <p>
              {t(
                "No actions match these filters. Check another source, status or department.",
                "ان فلٹر سے عمل نہیں۔ دوسرا ماخذ، حالت یا شعبہ دیکھیں۔",
              )}
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {[
                      t("Action / source", "عمل / ماخذ"),
                      t("Work / owner", "کام / ذمہ دار"),
                      t("Department", "شعبہ"),
                      t("Due / status", "تاریخ / حالت"),
                      t("Next", "اگلا قدم"),
                    ].map((v) => (
                      <th key={v}>{v}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.action_id}>
                      <td>
                        <bdi>{a.action_number}</bdi>
                        <br />
                        {sourceName(a.source)} ·{" "}
                        {(a.source === "Incident" && a.incident_id != null) ||
                        (a.source === "RecordReview" && a.cycle_id != null) ? (
                          <button
                            data-help="acr.source"
                            disabled={blocked}
                            onClick={() => setSourceRecord(a)}
                          >
                            {a.source_number}
                          </button>
                        ) : (
                          <bdi>{a.source_number}</bdi>
                        )}
                      </td>
                      <td>
                        {a.description}
                        <br />
                        {a.owner_name}
                      </td>
                      <td>
                        {a.department_name ?? t("Not recorded", "درج نہیں")}
                      </td>
                      <td className={a.is_overdue ? "error" : ""}>
                        {a.due_date} · {statusName(a.status)}
                        {a.is_overdue && (
                          <strong> · {t("Overdue", "تاخیر")}</strong>
                        )}
                      </td>
                      <td>
                        <button
                          data-help="acr.open"
                          disabled={blocked}
                          onClick={() => open(a.action_id)}
                        >
                          {t("Open action", "عمل کھولیں")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {detail && (
            <article className="card">
              <h2>
                {detail.action_number} · {statusName(detail.status)}
              </h2>
              <p>
                {sourceName(detail.source)} · {detail.source_number} ·{" "}
                {detail.action_type === "Corrective"
                  ? t("Corrective", "اصلاحی")
                  : t("Preventive", "احتیاطی")}
              </p>
              <p style={{ whiteSpace: "pre-wrap" }}>{detail.description}</p>
              <p>
                {t("Owner", "ذمہ دار")}: {detail.owner_name} ·{" "}
                {detail.department_name ??
                  t("Department not recorded", "شعبہ درج نہیں")}
              </p>
              <p className={detail.is_overdue ? "error" : ""}>
                {t("Due", "آخری تاریخ")}: {detail.due_date}{" "}
                {detail.is_overdue && t("Overdue", "تاخیر")}
              </p>
              {detail.outcome_note != null && (
                <>
                  <h3>{t("Final evidence / reason", "حتمی ثبوت / وجہ")}</h3>
                  <p style={{ whiteSpace: "pre-wrap" }}>
                    {detail.outcome_note}
                  </p>
                  <p>
                    {detail.completed_by_name ??
                      t("Name not recorded", "نام درج نہیں")}{" "}
                    · {time(detail.completed_at)}
                  </p>
                </>
              )}
              {editable && !editing && (
                <button
                  data-help="acr.edit"
                  onClick={() => {
                    setVersion(detail.row_version);
                    setStatus("");
                    setNote("");
                    setReviewed(false);
                    setEditing(true);
                  }}
                >
                  {t(
                    "Complete or cancel this action",
                    "یہ عمل مکمل یا منسوخ کریں",
                  )}
                </button>
              )}
              {detail.status !== "Open" && (
                <p>
                  {t(
                    "This decision is final. The action cannot be edited or reopened here.",
                    "یہ فیصلہ حتمی۔ یہاں عمل کی ترمیم یا دوبارہ کھولنا نہیں۔",
                  )}
                </p>
              )}
            </article>
          )}
        </>
      )}
      {editing && (
        <form className="card" onSubmit={submit}>
          <h2>{t("Review the action decision", "عمل کے فیصلے کا جائزہ")}</h2>
          {stale && (
            <p role="alert">
              {t(
                "The action changed after you opened this draft. Compare the current record, then cancel and reopen; never overwrite it.",
                "مسودہ کھولنے کے بعد عمل بدل گیا۔ تازہ ریکارڈ ملائیں، پھر منسوخ و دوبارہ کھولیں؛ پرانا نہ تھوپیں۔",
              )}
            </p>
          )}
          <fieldset disabled={!editable || stale}>
            <Field label={t("Decision", "فیصلہ")}>
              <select
                name="status"
                data-help="acr.decision"
                required
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as typeof status);
                  setReviewed(false);
                }}
              >
                <option value="">
                  {t("Choose after reviewing", "جائزے کے بعد چنیں")}
                </option>
                <option value="Done">
                  {t("Done with evidence", "ثبوت کے ساتھ مکمل")}
                </option>
                <option value="Cancelled">
                  {t("Cancelled with reason", "وجہ کے ساتھ منسوخ")}
                </option>
              </select>
            </Field>
            <Field
              label={
                status === "Cancelled"
                  ? t("Reason for cancellation", "منسوخی کی وجہ")
                  : t(
                      "What was done and its evidence",
                      "کیا کیا گیا اور اس کا ثبوت",
                    )
              }
            >
              <textarea
                name="note"
                data-help="acr.note"
                required
                minLength={3}
                maxLength={2000}
                rows={4}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setReviewed(false);
                }}
              />
            </Field>
            <label>
              <input
                data-help="acr.review"
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              {t(
                "I checked the work, source and evidence. This decision is final.",
                "کام، ماخذ اور ثبوت چیک کیے۔ یہ فیصلہ حتمی۔",
              )}
            </label>
            <button data-help="acr.submit" disabled={!reviewed || !status}>
              {t("Save this final decision", "یہ حتمی فیصلہ محفوظ کریں")}
            </button>
          </fieldset>
          <button
            type="button"
            data-help="acr.cancel"
            disabled={blocked}
            onClick={() => {
              setEditing(false);
              setReviewed(false);
            }}
          >
            {t("Cancel unsent decision", "غیر ارسال فیصلہ منسوخ")}
          </button>
        </form>
      )}
      <h2>
        {t("Register for the quality committee", "کوالٹی کمیٹی کا رجسٹر")}
      </h2>
      <p>
        {t(
          "The PDF includes actions recorded in the chosen period and every action still open, for the applied source. Status, overdue and department table filters do not restrict the PDF.",
          "پی ڈی ایف میں منتخب مدت کے درج اعمال اور ہر اب کھلا عمل، لاگو ماخذ کے لیے۔ حالت، تاخیر و شعبے کے جدول فلٹر پی ڈی ایف محدود نہیں کرتے۔",
        )}
      </p>
      {user.permissions.includes("quality.action.view") && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void paper(false);
          }}
        >
          <fieldset disabled={blocked || !connected}>
            <legend>{t("PDF period", "پی ڈی ایف مدت")}</legend>
            <div className="form-grid">
              <Field label={t("From", "سے")}>
                <input
                  data-help="acr.period"
                  type="date"
                  required
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </Field>
              <Field label={t("To", "تک")}>
                <input
                  data-help="acr.period"
                  type="date"
                  required
                  min={from}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
            </div>
            <button
              data-help="acr.pdf"
              type="button"
              onClick={(e) => {
                if (e.currentTarget.form?.reportValidity()) void paper(true);
              }}
            >
              {t("Preview action register PDF", "اعمال رجسٹر پی ڈی ایف دیکھیں")}
            </button>
            <button data-help="acr.pdf">
              {t("Save action register PDF", "اعمال رجسٹر پی ڈی ایف محفوظ")}
            </button>
          </fieldset>
        </form>
      )}
      <ErrorBox error={paperError} />
      {paperNotice && <p role="status">{paperNotice}</p>}
      {sourceRecord && (
        <ActionSourcePreview
          action={sourceRecord}
          timeZone={timeZone}
          onClose={() => setSourceRecord(undefined)}
        />
      )}
    </section>
  );
}
